# Usa la imagen de Node.js versión 20.10.0
FROM node:20.10.0

# Establece el directorio de trabajo en /app
WORKDIR /app

# Copia el archivo package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia todos los archivos del proyecto en el contenedor
COPY . .

# Expone el puerto en el que tu aplicación va a correr
EXPOSE 3000

# Define el comando para correr la aplicación
CMD ["node", "app.js"]
