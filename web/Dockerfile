FROM node:16-alpine3.11

RUN mkdir -p /app/src
WORKDIR /app/src

USER node

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

RUN npm i -g nodemon
EXPOSE 3000

CMD ["npm", "start"]
