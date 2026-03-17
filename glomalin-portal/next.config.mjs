import withSerwist from "@serwist/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

export default withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
