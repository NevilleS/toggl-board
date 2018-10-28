FROM node:8
LABEL maintainer="Neville Samuell"

# Setup the server
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Environment variables
ENV PORT 8080

# Run the server
EXPOSE ${PORT}
CMD [ "npm", "start" ]
USER node
