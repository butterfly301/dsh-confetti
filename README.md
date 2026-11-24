# dsh-confetti

一个独立的事件驱动 DSH 彩带特效插件，内置零依赖的 `canvas-confetti` v1.9.3，不绑定特定业务事件，监听 `dsh:confetti` 自定义事件即可触发，在系统开启「减少动态效果」时自动跳过。

## 独立安装与配置

```bash
dsh plugin --profile desktop add dsh-confetti
```

在 `cordis.patch.yml` 中注入 `pack` 后即可响应 `dsh:confetti` 事件：

```yaml
- insert:
    - id: dsh-confetti
      name: 'dsh-confetti'
      config:
        pack:
          colors: ['#f5c542', '#ffd966', '#ffb703', '#fb8500', '#ffffff']
          particleCount: 95
          spread: 78
          originY: 0.65
```

| 字段 | 类型 | 默认值 | 含义 |
|---|---|---|---|
| `pack` | `false \| object` | `false` | 彩带默认配置；`false` 时忽略事件 |
| `pack.colors` | `string[]` | 5 色数组 | 彩带色板 |
| `pack.particleCount` | `number` | `85` | 粒子数量，范围 `10–400` |
| `pack.spread` | `number` | `72` | 扩散角度，范围 `10–180` |
| `pack.originY` | `number` | `0.65` | 纵向发射起点，范围 `0–1` |

## 事件契约

```js
window.dispatchEvent(new CustomEvent('dsh:confetti', {
  detail: { colors, particleCount, spread, origin }, // 均可选，缺省使用 pack 默认值
}));
```

## 第三方组件署名

- `vendor/confetti.browser.js` 来自 [catdad/canvas-confetti](https://github.com/catdad/canvas-confetti) v1.9.3，采用 ISC 许可证，完整许可文本见 `vendor/CONFETTI-LICENSE.txt`。

## 许可

MIT
