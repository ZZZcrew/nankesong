export type AskInput = {
  transcript: string
}

export type AskResult = {
  text: string
}

// TODO(backend): 替换为 fetch('/api/diary/ask', { method: 'POST', body: JSON.stringify(input) }).then(r => r.json())
// 请保持返回签名 { text: string } 不变。失败时 throw 即可，调用方已做兜底。
export async function askBackend(input: AskInput): Promise<AskResult> {
  await new Promise((r) => setTimeout(r, 500))
  const q = input.transcript.trim()
  if (!q) return { text: '妈妈，我刚才没听清您说什么，您再说一遍好吗？' }
  return {
    text: `妈妈，我刚才听到您说，${q}。等小明回来，我把这个问题转告他，让他再写一封信给您。`,
  }
}
