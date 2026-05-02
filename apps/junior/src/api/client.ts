// 统一 API 封装层:切换 mock/真实后端只改这个文件
//
// 当后端接口就绪:
//   1. 把 USE_REAL_API 改为 true
//   2. 每个 stub 文件里 if(USE_REAL_API) 分支会走真实 fetch
//   3. 不用改任何 UI 调用点

export type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 接口文档约定的基础路径
export const BASE_URL = '/api/v1'

// 总开关:true 走真实后端,false 走 mock
export const USE_REAL_API = false

// mock 延迟,模拟网络耗时(体感更像真实调用)
export async function mockDelay<T>(data: T, ms = 300): Promise<T> {
  await new Promise((r) => setTimeout(r, ms))
  return data
}

// 真实 HTTP 调用,解包 { code, message, data } 封装
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`)
  const json = (await res.json()) as ApiResponse<T>
  if (json.code !== 200) throw new ApiError(json.code, json.message || 'unknown error')
  return json.data
}

// Demo 用的固定 user_id(真实上线后从登录态里拿)
export const JUNIOR_USER_ID = 'user_junior'
export const SENIOR_USER_ID = 'user_senior'
