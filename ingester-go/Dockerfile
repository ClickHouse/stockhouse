# Build
FROM golang:1.22-alpine AS build
WORKDIR /app

# Copy module files first (go.sum may not exist yet)
COPY go.mod ./
# If you already have go.sum, you can add: COPY go.sum ./

# Copy source and resolve deps from imports
COPY . .
ENV CGO_ENABLED=0
RUN go mod tidy \
 && go build -trimpath -ldflags="-s -w" -o massive-ingester

# Run
FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=build /app/massive-ingester .
ENTRYPOINT ["/app/massive-ingester"]
