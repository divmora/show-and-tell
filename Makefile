.PHONY: all dev-setup install build build-sdk build-react build-server test test-sdk test-react test-watch lint fmt clean pages demo start docker-build docker-build-multiarch

all: lint test build

dev-setup: install

install:
	pnpm install

build: build-sdk build-react build-server

build-sdk:
	pnpm run build:sdk

build-react:
	pnpm run build:react

build-server:
	pnpm run build:server

test:
	pnpm test

test-sdk:
	pnpm run test:sdk

test-react:
	pnpm run test:react

test-watch:
	pnpm --filter @divmora/show-and-tell run test:watch

lint:
	pnpm run lint

fmt:
	pnpm run fmt

clean:
	@rm -rf packages/sdk/dist packages/react/dist packages/server/dist site node_modules/.cache coverage
	@echo "Clean complete."

pages:
	pnpm run build:pages

demo:
	pnpm run demo

start:
	pnpm start

docker-build:
	docker build -t show-and-tell:latest .

docker-build-multiarch:
	docker buildx build --platform linux/amd64,linux/arm64 -t show-and-tell:latest .
