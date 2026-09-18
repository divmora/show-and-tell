# Changelog

## [0.3.0](https://github.com/divmora/show-and-tell/compare/v0.2.0...v0.3.0) (2026-09-18)


### Features

* **audio:** add Live Microphone Audio Level Meter (VU Meter) and Silent Mic Alert ([#12](https://github.com/divmora/show-and-tell/issues/12)) ([23986ee](https://github.com/divmora/show-and-tell/commit/23986ee0e6781f57db66f2b8ce611bc4969d4565))
* **ci:** automate npm releases and configure [@divmora](https://github.com/divmora) package scopes ([6736292](https://github.com/divmora/show-and-tell/commit/6736292f35008f283484ffdb45b815784a61b888))
* **diagnostics:** add Full Network Request & Response Inspector (HAR-lite) ([#19](https://github.com/divmora/show-and-tell/issues/19)) ([ac88a75](https://github.com/divmora/show-and-tell/commit/ac88a752e43fe0d2eb5de0be244cb131cc2486c5))
* **editor:** add Post-Recording Video Trimmer & Cut Tool ([#17](https://github.com/divmora/show-and-tell/issues/17)) ([f113451](https://github.com/divmora/show-and-tell/commit/f1134517819885d3b98587908d7d08b282a2a621))
* **react:** add drop-in React hooks and components package (@show-and-tell/react) ([#22](https://github.com/divmora/show-and-tell/issues/22)) ([96c43b1](https://github.com/divmora/show-and-tell/commit/96c43b1f061f221784e8f03f1af0f1edb186086a))
* **sdk:** add 16:9 Google Meet PiP webcam, Document PiP controls, and live embed generator ([5b8f5f5](https://github.com/divmora/show-and-tell/commit/5b8f5f526bf9a5584333ab338c6b8e2d892c5c77))
* **sdk:** add DOM session recording, fine-grained PII masking, and zoom player controls ([c0aced7](https://github.com/divmora/show-and-tell/commit/c0aced7fd5fbd314eae4fe1843851aa9297a1c1e))
* **storage:** add direct S3, R2, and Supabase presigned URL uploads with real-time progress ([601e9a8](https://github.com/divmora/show-and-tell/commit/601e9a84fb1229ab7f4bd6214cdfc1d1c89dbd76))
* **storage:** add IndexedDB auto-pruning & storage budget cap ([#20](https://github.com/divmora/show-and-tell/issues/20)) ([3f234a5](https://github.com/divmora/show-and-tell/commit/3f234a5dd2b7ee2d1faccbf8c7bd21f2d0b8d0b2))
* **theming:** add Custom Theming, White-Label Styling, and CSS Tokens ([#21](https://github.com/divmora/show-and-tell/issues/21)) ([dc794cc](https://github.com/divmora/show-and-tell/commit/dc794cc78b748b8ea4f6f6b72edb33fe2bc60dfd))
* **ux:** add Click Ripple Effect and Cursor Spotlight with toolbar toggle ([#14](https://github.com/divmora/show-and-tell/issues/14)) ([b40c83b](https://github.com/divmora/show-and-tell/commit/b40c83ba1773a24cf9ceb0b3fc13c8d85c97ff35))
* **ux:** add Pre-Recording 3-2-1 Countdown Overlay with skip and audio ticks ([#13](https://github.com/divmora/show-and-tell/issues/13)) ([978cf7a](https://github.com/divmora/show-and-tell/commit/978cf7a6290671d9d09a826a7a9320e1d2433d2d))


### Bug Fixes

* **ci:** ensure SDK types are built before linting and testing React package ([8fcaa53](https://github.com/divmora/show-and-tell/commit/8fcaa538775b83b9c95d3ae20d71bf35bf0cde7c))
* **deps:** upgrade multer to 2.3.0 and node to 26.8.1 ([8e2c3b8](https://github.com/divmora/show-and-tell/commit/8e2c3b872850aaef4ed0d4400edfd0a5cd2e35c8))
* **sdk:** add mobile getDisplayMedia capability detection and DOM fallback ([#11](https://github.com/divmora/show-and-tell/issues/11)) ([30eed60](https://github.com/divmora/show-and-tell/commit/30eed60835d60df5e6e47d27692f572012b51d26))


### Documentation

* **roadmap:** add living product roadmap and agent maintenance guidelines ([e2463f7](https://github.com/divmora/show-and-tell/commit/e2463f738f5da05ae1b917a18ac8bf6facca3115))
* **roadmap:** link roadmap capabilities to GitHub issues [#12](https://github.com/divmora/show-and-tell/issues/12) through [#22](https://github.com/divmora/show-and-tell/issues/22) ([690bfe6](https://github.com/divmora/show-and-tell/commit/690bfe6094f07313340438567f248c8e231970d0))
* standardize repo configs, roadmap deduplication, and release packaging ([1425fd7](https://github.com/divmora/show-and-tell/commit/1425fd7aabf268eb2c353d9ee134239ee0091bd8))


### Build System

* **ci:** upgrade Node.js target to 26 across workflows and Dockerfile ([2efd391](https://github.com/divmora/show-and-tell/commit/2efd391b3afd8543137c08978cb7843861dc48a0))

## [0.2.0](https://github.com/divmora/show-and-tell/compare/v0.1.0...v0.2.0) (2026-09-06)


### Features

* **demo:** add github repository navigation and footer links to playground ([0f5e832](https://github.com/divmora/show-and-tell/commit/0f5e8323ad36f0bf93ee42866b0bb03ea6d97b59))
* **demo:** add high-visibility top navigation bar and hero github action buttons ([9c0bb28](https://github.com/divmora/show-and-tell/commit/9c0bb28f0d353308c2d79da10f7cec0a357b6ac2))
* initialize repository with show-and-tell sdk, demo, and divmora workflows ([7dd18c9](https://github.com/divmora/show-and-tell/commit/7dd18c98b7c5fdd560b0c6bdea51f3666660c837))


### Documentation

* **demo:** add deepwiki integration, popular use cases, and seo metadata ([811b81c](https://github.com/divmora/show-and-tell/commit/811b81cf390bba44807bf39923565a643cd06fce))
