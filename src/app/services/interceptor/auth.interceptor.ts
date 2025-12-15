import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Get the token from LocalStorage (We need to make sure you save it there on login!)
  const token = localStorage.getItem('auth_token');

  // 2. Clone the request and add the header
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  // 3. If no token, just pass the request through
  return next(req);
};