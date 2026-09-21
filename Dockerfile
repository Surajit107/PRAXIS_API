FROM node:20.13.1-alpine

RUN mkdir -p /usr/src/praxis-api && chown -R node:node /usr/src/praxis-api

WORKDIR /usr/src/praxis-api

# Copy package json and lock only to optimise the image building
COPY package.json package-lock.json ./

USER node

RUN npm install --omit=dev

COPY --chown=node:node . .

EXPOSE 8000

# Wait for Postgres → apply drizzle migrations → start without nodemon
CMD ["npm", "run", "start:docker"]
