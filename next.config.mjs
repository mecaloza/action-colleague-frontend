const REDIRECTS = [
  ["/admin/dashboard", "/admin"],
  ["/admin/employees", "/admin/team"],
  ["/dashboard", "/learn"],
  ["/courses", "/learn"],
  ["/courses/:id", "/learn/:id"],
  // Sections removed from the product.
  ["/admin/org-chart", "/admin"],
  ["/admin/communications", "/admin"],
  ["/admin/documents", "/admin"],
  ["/admin/series/:path*", "/admin/courses"],
  ["/documents", "/learn"],
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return REDIRECTS.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
