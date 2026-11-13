import { BaseApp } from '@zeppos/zml/base-app'

App(
  BaseApp({
    // @ts-ignore — zml fills `messaging` at runtime
    globalData: {},
    onCreate() {},
    onDestroy() {},
  }),
)
