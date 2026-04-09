import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(async () => ({ data: { data: { token: 'x', user: { name: 'Demo' } } } })),
  },
}));

import authService from '../services/authService';

describe('Auth API service', () => {
  it('returns success response on login', async () => {
    const result = await authService.login({ email: 'x@y.com', password: '12345678' });
    expect(result.token).toBe('x');
  });
});
