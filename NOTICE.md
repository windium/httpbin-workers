# Notices and content provenance

httpbin-workers is an independent reimplementation of the API of
[httpbin](https://github.com/postmanlabs/httpbin) (ISC License, © Kenneth Reitz). No httpbin
source code is used. To stay compatible, a few small, functional fixtures are reproduced as-is:

- the `/json` and `/xml` "slideshow" sample documents,
- short protocol strings such as the Digest realm, the `/status/402` and `/status/406` bodies,
  the `x-more-info` URLs and the `Incorrect Base64 data` message.

Everything else is original to this project:

- **Images** (`assets/images/*.svg`, and the PNG/JPEG/WebP files rendered from them) are original
  vector illustrations made for this project. httpbin's photos are not used.
- **ASCII art** for `/deny` and `/status/418`, the `/encoding/utf8` demo page, the HTML form,
  the landing page and all endpoint descriptions are original.
- **`/html`** contains the opening of *Moby-Dick* by Herman Melville (1851), which is in the
  public domain.
