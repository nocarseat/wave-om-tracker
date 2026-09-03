self.__MIDDLEWARE_MATCHERS = [
  {
    "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp)$).*))(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"
  }
];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()