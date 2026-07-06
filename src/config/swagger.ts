import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Distributed URL Shortener API (Bitly Clone)',
      version: '1.0.0',
      description: 'A production-grade, highly performant Distributed URL Shortener API with Redis caching, rate limiting, click analytics, and user authentication.',
      contact: {
        name: 'API Support',
        url: 'https://github.com/snehithyerra13-cell/backend',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current Environment Host',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js', './src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app: Express) {
  // Serve Swagger UI
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  
  // Serve raw JSON spec
  app.get('/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
