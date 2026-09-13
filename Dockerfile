FROM node:20-slim
ARG SERVICE_TARGET=ingress
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080
ENV SERVICE_TARGET=${SERVICE_TARGET}
EXPOSE 8080
CMD ["npm", "start"]
