// PrismaClient singleton for grain-tickets
// Prevents "too many connections" from multiple instantiations during dev hot-reload (nodemon)
// Pattern: organic-cert/src/lib/prisma.ts adapted to CommonJS

require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;
