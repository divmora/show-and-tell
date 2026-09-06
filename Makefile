.PHONY: all dev-setup install build build-sdk build-server test test-watch lint fmt clean pages demo start docker-build docker-build-multiarch

all: lint test build

dev-setup: install

install:
	npm install

build: build-sdk build-server

build-sdk:
	npm run build

build-server:
	npm run build:server

test:
	npm test

test-watch:
	npm run test:watch --workspace=packages/sdk

lint:
	npm run lint

fmt:
	npm run fmt

clean:
	@rm -rf packages/sdk/dist packages/server/dist site node_modules/.cache coverage
	@echo "Clean complete."

pages:
	npm run build:pages

demo:
	npm run demo

start:
	npm start

docker-build:
	docker build -t show-and-tell:latest .

docker-build-multiarch:
	docker buildx build --platform linux/amd64,linux/arm64 -t show-and-tell:latest .
