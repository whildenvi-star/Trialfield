// Vitest global test setup
// Required by vitest.config.ts setupFiles
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)
