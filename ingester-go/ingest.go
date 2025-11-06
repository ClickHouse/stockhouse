package main

import (
	"context"
	"crypto/tls"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gorilla/websocket"
)

type U64 uint64

func (u *U64) UnmarshalJSON(b []byte) error {
	var n uint64
	if err := json.Unmarshal(b, &n); err == nil {
		*u = U64(n)
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	v, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return err
	}
	*u = U64(v)
	return nil
}

type StockQuote struct {
	Ev     string  `json:"ev"`
	Sym    string  `json:"sym"`
	Symbol string  `json:"symbol"` // fallback
	Bx     uint8   `json:"bx"`
	Bp     float64 `json:"bp"`
	Bs     U64     `json:"bs"`
	Ax     uint8   `json:"ax"`
	Ap     float64 `json:"ap"`
	As     U64     `json:"as"`
	C      any     `json:"c"`
	I      []uint8 `json:"i"`
	T      uint64  `json:"t"`
	Q      uint64  `json:"q"`
	Z      uint8   `json:"z"`
}

type StockTrade struct {
	Ev     string  `json:"ev"`
	Sym    string  `json:"sym"`
	Symbol string  `json:"symbol"` // fallback
	I      string  `json:"i"`
	X      uint8   `json:"x"`
	P      float64 `json:"p"`
	S      U64     `json:"s"`
	C      []uint8 `json:"c"`
	T      uint64  `json:"t"`
	Q      uint64  `json:"q"`
	Z      uint8   `json:"z"`
	Trfi   uint64  `json:"trfi"`
	Trft   uint64  `json:"trft"`
}

type CryptoQuote struct {
	Ev   string  `json:"ev"`
	Pair string  `json:"pair"`
	Bp   float64 `json:"bp"`
	Bs   float64 `json:"bs"`
	Ap   float64 `json:"ap"`
	As   float64 `json:"as"`
	T    uint64  `json:"t"`
	X    uint8   `json:"x"`
	R    uint64  `json:"r"`
}

type CryptoTrade struct {
	Ev   string  `json:"ev"`
	Pair string  `json:"pair"`
	P    float64 `json:"p"`
	T    uint64  `json:"t"`
	S    float64 `json:"s"`
	C    []uint8 `json:"c"`
	I    string  `json:"i"`
	X    uint8   `json:"x"`
	R    uint64  `json:"r"`
}

type FMV struct {
	Ev  string  `json:"ev"`
	Sym string  `json:"sym"`
	Fmv float64 `json:"fmv"`
	T   uint64  `json:"t"`
}

const (
	chanCap     = 200_000
	maxRows     = 50_000
	maxInterval = time.Second
)

func main() {
	apiKey := mustEnv("MASSIVE_API_KEY")
	chAddr := mustEnv("CLICKHOUSE_HOST") // e.g. host:9440 (native TLS)
	chUser := mustEnv("CLICKHOUSE_USER")
	chPass := os.Getenv("CLICKHOUSE_PASSWORD")
	chDB := os.Getenv("CLICKHOUSE_DB")
	secure := os.Getenv("CLICKHOUSE_SECURE") == "true"
	host, _, _ := strings.Cut(chAddr, ":")
	var tlsCfg *tls.Config
	if secure {
		tlsCfg = &tls.Config{
			ServerName:         host,
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: true, // ok for dev only
		}
	}
	cli := clickhouse.OpenDB(&clickhouse.Options{
		Addr:     []string{chAddr},
		Protocol: clickhouse.Native,
		Auth: clickhouse.Auth{
			Username: chUser,
			Password: chPass,
		},
		TLS:         tlsCfg,
		DialTimeout: 30 * time.Second,
		Compression: &clickhouse.Compression{Method: clickhouse.CompressionLZ4},
	})
	defer cli.Close()

	ctxPing, cancelPing := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelPing()
	if err := cli.PingContext(ctxPing); err != nil {
		log.Fatalf("clickhouse ping failed: %v", err)
	}

	// Channels
	qCh := make(chan StockQuote, chanCap)
	tCh := make(chan StockTrade, chanCap)
	cqCh := make(chan CryptoQuote, chanCap)
	ctCh := make(chan CryptoTrade, chanCap)
	fmvCh := make(chan FMV, chanCap)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Insert workers
	var wg sync.WaitGroup
	wg.Add(5)
	go insertQuotes(ctx, &wg, cli, chDB, qCh)
	go insertTrades(ctx, &wg, cli, chDB, tCh)
	go insertCryptoQuotes(ctx, &wg, cli, chDB, cqCh)
	go insertCryptoTrades(ctx, &wg, cli, chDB, ctCh)
	go insertFmv(ctx, &wg, cli, chDB, fmvCh)

	// WS readers
	go stocksWS(ctx, apiKey, "wss://delayed-business.polygon.io/stocks", []string{"Q.*", "T.*"}, qCh, tCh)
	go cryptoWS(ctx, apiKey, "wss://socket.polygon.io/crypto", []string{"XT.*", "XQ.*"}, cqCh, ctCh)
	go fmvWS(ctx, apiKey, "wss://business.polygon.io/stocks", []string{"FMV.*"}, fmvCh)

	// Backpressure monitor + shedding
	go func() {
		t := time.NewTicker(10 * time.Second)
		for range t.C {
			ql, tl, cql, ctl, fl := len(qCh), len(tCh), len(cqCh), len(ctCh), len(fmvCh)
			log.Printf("[queues] quotes=%d trades=%d cquotes=%d ctrades=%d fmv=%d", ql, tl, cql, ctl, fl)
			if ql > chanCap*95/100 { dropN(qCh, 1000) }
			if tl > chanCap*95/100 { dropN(tCh, 1000) }
			if cql > chanCap*95/100 { dropN(cqCh, 1000) }
			if ctl > chanCap*95/100 { dropN(ctCh, 1000) }
			if fl > chanCap*95/100 { dropN(fmvCh, 1000) }
		}
	}()

	select {}
}

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing %s", k)
	}
	return v
}

func stocksWS(ctx context.Context, apiKey, url string, subs []string, qCh chan<- StockQuote, tCh chan<- StockTrade) {
	backoff := 5 * time.Second
	maxBackoff := 2 * time.Minute

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		conn, _, err := websocket.DefaultDialer.Dial(url, http.Header{})
		if err != nil {
			log.Printf("stocks dial: %v, retrying in %v", err, backoff)
			time.Sleep(backoff)
			backoff = min(backoff*2, maxBackoff)
			continue
		}

		send := func(v any) { _ = conn.WriteJSON(v) }
		send(map[string]string{"action": "auth", "params": apiKey})
		send(map[string]string{"action": "subscribe", "params": join(subs)})
		log.Printf("stocks: connected to %s", url)
		backoff = 5 * time.Second // reset on successful connection

		for {
			select {
			case <-ctx.Done():
				conn.Close()
				return
			default:
			}

			_, data, err := conn.ReadMessage()
			if err != nil {
				log.Printf("stocks read: %v, reconnecting in %v", err, backoff)
				conn.Close()
				time.Sleep(backoff)
				backoff = min(backoff*2, maxBackoff)
				break // break inner loop to reconnect
			}

			var frames []json.RawMessage
			if err := json.Unmarshal(data, &frames); err != nil {
				log.Printf("stocks json: %v", err)
				continue
			}
			for _, f := range frames {
				var meta struct{ Ev string `json:"ev"` }
				_ = json.Unmarshal(f, &meta)
				switch meta.Ev {
				case "Q":
					var q StockQuote
					if err := json.Unmarshal(f, &q); err == nil {
						if q.Sym == "" && q.Symbol != "" {
							q.Sym = q.Symbol
						}
						q.C = normalizeC(q.C)
						select {
						case qCh <- q:
						default:
						}
					} else {
						log.Printf("decode Q failed: %v", err)
					}
				case "T":
					var t StockTrade
					if err := json.Unmarshal(f, &t); err == nil {
						if t.Sym == "" && t.Symbol != "" {
							t.Sym = t.Symbol
						}
						select {
						case tCh <- t:
						default:
						}
					} else {
						log.Printf("decode T failed: %v", err)
					}
				}
			}
		}
	}
}

func cryptoWS(ctx context.Context, apiKey, url string, subs []string, cqCh chan<- CryptoQuote, ctCh chan<- CryptoTrade) {
	backoff := 5 * time.Second
	maxBackoff := 2 * time.Minute

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		conn, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			log.Printf("crypto dial: %v, retrying in %v", err, backoff)
			time.Sleep(backoff)
			backoff = min(backoff*2, maxBackoff)
			continue
		}

		_ = conn.WriteJSON(map[string]string{"action": "auth", "params": apiKey})
		_ = conn.WriteJSON(map[string]string{"action": "subscribe", "params": join(subs)})
		log.Printf("crypto: connected to %s", url)
		backoff = 5 * time.Second

		for {
			select {
			case <-ctx.Done():
				conn.Close()
				return
			default:
			}

			_, data, err := conn.ReadMessage()
			if err != nil {
				log.Printf("crypto read: %v, reconnecting in %v", err, backoff)
				conn.Close()
				time.Sleep(backoff)
				backoff = min(backoff*2, maxBackoff)
				break
			}

			var frames []json.RawMessage
			if err := json.Unmarshal(data, &frames); err != nil {
				continue
			}
			for _, f := range frames {
				var meta struct{ Ev string `json:"ev"` }
				_ = json.Unmarshal(f, &meta)
				switch meta.Ev {
				case "XQ":
					var q CryptoQuote
					if json.Unmarshal(f, &q) == nil {
						select {
						case cqCh <- q:
						default:
						}
					}
				case "XT":
					var t CryptoTrade
					if json.Unmarshal(f, &t) == nil {
						select {
						case ctCh <- t:
						default:
						}
					}
				}
			}
		}
	}
}

func fmvWS(ctx context.Context, apiKey, url string, subs []string, fmvCh chan<- FMV) {
	backoff := 5 * time.Second
	maxBackoff := 2 * time.Minute

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		conn, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			log.Printf("fmv dial: %v, retrying in %v", err, backoff)
			time.Sleep(backoff)
			backoff = min(backoff*2, maxBackoff)
			continue
		}

		_ = conn.WriteJSON(map[string]string{"action": "auth", "params": apiKey})
		_ = conn.WriteJSON(map[string]string{"action": "subscribe", "params": join(subs)})
		log.Printf("fmv: connected to %s", url)
		backoff = 5 * time.Second

		for {
			select {
			case <-ctx.Done():
				conn.Close()
				return
			default:
			}

			_, data, err := conn.ReadMessage()
			if err != nil {
				log.Printf("fmv read: %v, reconnecting in %v", err, backoff)
				conn.Close()
				time.Sleep(backoff)
				backoff = min(backoff*2, maxBackoff)
				break
			}

			var frames []json.RawMessage
			if err := json.Unmarshal(data, &frames); err != nil {
				continue
			}
			for _, f := range frames {
				var meta struct{ Ev string `json:"ev"` }
				_ = json.Unmarshal(f, &meta)
				if meta.Ev == "FMV" {
					var m FMV
					if json.Unmarshal(f, &m) == nil {
						select {
						case fmvCh <- m:
						default:
						}
					}
				}
			}
		}
	}
}

func normalizeC(c any) uint8 {
	switch v := c.(type) {
	case float64:
		return uint8(v)
	case []any:
		if len(v) > 0 {
			if f, ok := v[0].(float64); ok {
				return uint8(f)
			}
		}
	}
	return 0
}

func insertQuotes(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, chDB string, in <-chan StockQuote) {
	defer wg.Done()
	tick := time.NewTicker(maxInterval)
	defer tick.Stop()

	var (
		sym []string
		bx  []uint8
		bp  []float64
		bs  []uint64
		ax  []uint8
		ap  []float64
		as  []uint64
		c   []uint8
		i   [][]uint8
		t   []uint64
		q   []uint64
		z   []uint8
	)

	reset := func() {
		sym = sym[:0]; bx = bx[:0]; bp = bp[:0]; bs = bs[:0]
		ax = ax[:0]; ap = ap[:0]; as = as[:0]; c = c[:0]
		i = i[:0]; t = t[:0]; q = q[:0]; z = z[:0]
	}

	flush := func() {
		if len(sym) == 0 {
			return
		}
		ctxIns, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		tx, err := db.BeginTx(ctxIns, nil)
		if err != nil {
			log.Printf("quotes begin tx: %v", err)
			reset()
			return
		}
		stmt, err := tx.PrepareContext(ctxIns, fmt.Sprintf("INSERT INTO %s.quotes (sym,bx,bp,bs,ax,ap,as,c,i,t,q,z) VALUES", chDB))
		if err != nil {
			_ = tx.Rollback()
			log.Printf("quotes prepare: %v", err)
			reset()
			return
		}
		for k := range sym {
			if _, err := stmt.ExecContext(ctxIns, sym[k], bx[k], bp[k], bs[k], ax[k], ap[k], as[k], c[k], i[k], t[k], q[k], z[k]); err != nil {
				_ = stmt.Close()
				_ = tx.Rollback()
				log.Printf("quotes exec row %d: %v", k, err)
				reset()
				return
			}
		}
		if err := stmt.Close(); err != nil {
			_ = tx.Rollback()
			log.Printf("quotes stmt close: %v", err)
			reset()
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("quotes commit: %v", err)
			reset()
			return
		}
		reset()
	}

	for {
		select {
		case m := <-in:
			if m.Sym == "" {
				continue
			}
			sym = append(sym, m.Sym)
			bx = append(bx, m.Bx)
			bp = append(bp, m.Bp)
			bs = append(bs, uint64(m.Bs))
			ax = append(ax, m.Ax)
			ap = append(ap, m.Ap)
			as = append(as, uint64(m.As))
			c = append(c, normalizeC(m.C))
			i = append(i, m.I)
			t = append(t, m.T)
			q = append(q, m.Q)
			z = append(z, m.Z)
			if len(sym) >= maxRows {
				flush()
			}
		case <-tick.C:
			flush()
		case <-ctx.Done():
			flush()
			return
		}
	}
}

func insertTrades(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, chDB string, in <-chan StockTrade) {
	defer wg.Done()
	tick := time.NewTicker(maxInterval)
	defer tick.Stop()

	var sym []string
	var iID []string
	var x []uint8
	var p []float64
	var s []uint64
	var c [][]uint8
	var tts []uint64
	var q []uint64
	var z []uint8
	var trfi []uint64
	var trft []uint64

	reset := func() {
		sym = nil; iID = nil; x = nil; p = nil; s = nil; c = nil
		tts = nil; q = nil; z = nil; trfi = nil; trft = nil
	}

	flush := func() {
		if len(sym) == 0 {
			return
		}
		ctxIns, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		tx, err := db.BeginTx(ctxIns, nil)
		if err != nil {
			log.Printf("trades begin tx: %v", err)
			reset()
			return
		}
		stmt, err := tx.PrepareContext(ctxIns, fmt.Sprintf("INSERT INTO %s.trades (sym,i,x,p,s,c,t,q,z,trfi,trft) VALUES", chDB))
		if err != nil {
			_ = tx.Rollback()
			log.Printf("trades prepare: %v", err)
			reset()
			return
		}
		for k := range sym {
			if _, err := stmt.ExecContext(ctxIns, sym[k], iID[k], x[k], p[k], s[k], c[k], tts[k], q[k], z[k], trfi[k], trft[k]); err != nil {
				_ = stmt.Close()
				_ = tx.Rollback()
				log.Printf("trades exec row %d: %v", k, err)
				reset()
				return
			}
		}
		if err := stmt.Close(); err != nil {
			_ = tx.Rollback()
			log.Printf("trades stmt close: %v", err)
			reset()
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("trades commit: %v", err)
			reset()
			return
		}
		reset()
	}

	for {
		select {
		case m := <-in:
			if m.Sym == "" {
				continue
			}
			sym = append(sym, m.Sym)
			iID = append(iID, m.I)
			x = append(x, m.X)
			p = append(p, m.P)
			s = append(s, uint64(m.S))
			c = append(c, m.C)
			tts = append(tts, m.T)
			q = append(q, m.Q)
			z = append(z, m.Z)
			trfi = append(trfi, m.Trfi)
			trft = append(trft, m.Trft)
			if len(sym) >= maxRows {
				flush()
			}
		case <-tick.C:
			flush()
		case <-ctx.Done():
			flush()
			return
		}
	}
}

func insertCryptoQuotes(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, chDB string, in <-chan CryptoQuote) {
	defer wg.Done()
	tick := time.NewTicker(maxInterval)
	defer tick.Stop()

	var pair []string
	var bp, bs, ap, as []float64
	var tts []uint64
	var x []uint8
	var r []uint64

	reset := func() { pair = nil; bp = nil; bs = nil; ap = nil; as = nil; tts = nil; x = nil; r = nil }

	flush := func() {
		if len(pair) == 0 {
			return
		}
		ctxIns, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		tx, err := db.BeginTx(ctxIns, nil)
		if err != nil {
			log.Printf("crypto_quotes begin tx: %v", err)
			reset()
			return
		}
		stmt, err := tx.PrepareContext(ctxIns, fmt.Sprintf("INSERT INTO %s.crypto_quotes (pair,bp,bs,ap,as,t,x,r) VALUES", chDB))
		if err != nil {
			_ = tx.Rollback()
			log.Printf("crypto_quotes prepare: %v", err)
			reset()
			return
		}
		for k := range pair {
			if _, err := stmt.ExecContext(ctxIns, pair[k], bp[k], bs[k], ap[k], as[k], tts[k], x[k], r[k]); err != nil {
				_ = stmt.Close()
				_ = tx.Rollback()
				log.Printf("crypto_quotes exec row %d: %v", k, err)
				reset()
				return
			}
		}
		if err := stmt.Close(); err != nil {
			_ = tx.Rollback()
			log.Printf("crypto_quotes stmt close: %v", err)
			reset()
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("crypto_quotes commit: %v", err)
			reset()
			return
		}
		reset()
	}

	for {
		select {
		case m := <-in:
			pair = append(pair, m.Pair)
			bp = append(bp, m.Bp)
			bs = append(bs, m.Bs)
			ap = append(ap, m.Ap)
			as = append(as, m.As)
			tts = append(tts, m.T)
			x = append(x, m.X)
			r = append(r, m.R)
			if len(pair) >= maxRows {
				flush()
			}
		case <-tick.C:
			flush()
		case <-ctx.Done():
			flush()
			return
		}
	}
}

func insertCryptoTrades(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, chDB string, in <-chan CryptoTrade) {
	defer wg.Done()
	tick := time.NewTicker(maxInterval)
	defer tick.Stop()

	var pair []string
	var p []float64
	var tts []uint64
	var s []float64
	var c [][]uint8
	var iID []string
	var x []uint8
	var r []uint64

	reset := func() { pair = nil; p = nil; tts = nil; s = nil; c = nil; iID = nil; x = nil; r = nil }

	flush := func() {
		if len(pair) == 0 {
			return
		}
		ctxIns, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		tx, err := db.BeginTx(ctxIns, nil)
		if err != nil {
			log.Printf("crypto_trades begin tx: %v", err)
			reset()
			return
		}
		stmt, err := tx.PrepareContext(ctxIns, fmt.Sprintf("INSERT INTO %s.crypto_trades (pair,p,t,s,c,i,x,r) VALUES", chDB))
		if err != nil {
			_ = tx.Rollback()
			log.Printf("crypto_trades prepare: %v", err)
			reset()
			return
		}
		for k := range pair {
			if _, err := stmt.ExecContext(ctxIns, pair[k], p[k], tts[k], s[k], c[k], iID[k], x[k], r[k]); err != nil {
				_ = stmt.Close()
				_ = tx.Rollback()
				log.Printf("crypto_trades exec row %d: %v", k, err)
				reset()
				return
			}
		}
		if err := stmt.Close(); err != nil {
			_ = tx.Rollback()
			log.Printf("crypto_trades stmt close: %v", err)
			reset()
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("crypto_trades commit: %v", err)
			reset()
			return
		}
		reset()
	}

	for {
		select {
		case m := <-in:
			pair = append(pair, m.Pair)
			p = append(p, m.P)
			tts = append(tts, m.T)
			s = append(s, m.S)
			c = append(c, m.C)
			iID = append(iID, m.I)
			x = append(x, m.X)
			r = append(r, m.R)
			if len(pair) >= maxRows {
				flush()
			}
		case <-tick.C:
			flush()
		case <-ctx.Done():
			flush()
			return
		}
	}
}

func insertFmv(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, chDB string, in <-chan FMV) {
	defer wg.Done()
	tick := time.NewTicker(maxInterval)
	defer tick.Stop()

	var sym []string
	var fmv []float64
	var tts []uint64

	reset := func() { sym = nil; fmv = nil; tts = nil }

	flush := func() {
		if len(sym) == 0 {
			return
		}
		ctxIns, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		tx, err := db.BeginTx(ctxIns, nil)
		if err != nil {
			log.Printf("fmv begin tx: %v", err)
			reset()
			return
		}
		stmt, err := tx.PrepareContext(ctxIns, fmt.Sprintf("INSERT INTO %s.stock_fmv (sym,fmv,t) VALUES", chDB))
		if err != nil {
			_ = tx.Rollback()
			log.Printf("fmv prepare: %v", err)
			reset()
			return
		}
		for k := range sym {
			if _, err := stmt.ExecContext(ctxIns, sym[k], fmv[k], tts[k]); err != nil {
				_ = stmt.Close()
				_ = tx.Rollback()
				log.Printf("fmv exec row %d: %v", k, err)
				reset()
				return
			}
		}
		if err := stmt.Close(); err != nil {
			_ = tx.Rollback()
			log.Printf("fmv stmt close: %v", err)
			reset()
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("fmv commit: %v", err)
			reset()
			return
		}
		reset()
	}

	for {
		select {
		case m := <-in:
			sym = append(sym, m.Sym)
			fmv = append(fmv, m.Fmv)
			tts = append(tts, m.T)
			if len(sym) >= maxRows {
				flush()
			}
		case <-tick.C:
			flush()
		case <-ctx.Done():
			flush()
			return
		}
	}
}

func join(ss []string) string {
	if len(ss) == 0 {
		return ""
	}
	out := ss[0]
	for i := 1; i < len(ss); i++ {
		out += "," + ss[i]
	}
	return out
}

func dropN[T any](ch chan T, n int) {
	for i := 0; i < n; i++ {
		select {
		case <-ch:
		default:
			return
		}
	}
}
