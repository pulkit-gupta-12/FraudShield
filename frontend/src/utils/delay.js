export const delay = (minMs = 300, maxMs = 800) => {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs))
  return new Promise((resolve) => setTimeout(resolve, ms))
}
