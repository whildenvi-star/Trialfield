function deriveCropYear(): number {
  const now = new Date()
  return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear()
}

export const CURRENT_CROP_YEAR = process.env.NEXT_PUBLIC_CROP_YEAR
  ? parseInt(process.env.NEXT_PUBLIC_CROP_YEAR, 10)
  : deriveCropYear()
