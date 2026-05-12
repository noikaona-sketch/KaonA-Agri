export function isAdminWebPath(pathname: string) {
  return (
    pathname === '/admin-login' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/admin-prototype' ||
    pathname.startsWith('/admin-prototype/')
  );
}
