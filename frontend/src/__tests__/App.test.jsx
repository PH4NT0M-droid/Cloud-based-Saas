import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { store } from '../store';

describe('App routing', () => {
  it('renders login page route', () => {
    const { getByRole, getByText } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      </Provider>,
    );

    expect(getByText(/Sign in to the SaaS panel/i)).toBeTruthy();
    expect(getByRole('button', { name: /login/i })).toBeTruthy();
  });
});
