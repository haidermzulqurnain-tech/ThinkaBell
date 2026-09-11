/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: 'standalone' output requires symlink support (Linux/macOS or Windows with Developer Mode).
  // For Hostinger Node.js hosting, deploy the full project and run `next start`.
  // To enable standalone on CI/Linux servers, set OUTPUT=standalone env var.
  ...(process.env.OUTPUT === "standalone" ? { output: "standalone" } : {}),
  transpilePackages: ["@thinkabell/config", "@thinkabell/database", "@thinkabell/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "i.ebayimg.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
