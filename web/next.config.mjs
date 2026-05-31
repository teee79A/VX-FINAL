/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,

  async rewrites() {
    const apiTarget = process.env.API_URL ?? "http://localhost:7900";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
      {
        source: "/ws",
        destination: `${apiTarget}/ws`,
      },
    ];
  },
};

export default config;
