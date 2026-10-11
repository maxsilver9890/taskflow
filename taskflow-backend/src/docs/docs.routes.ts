import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { openapiDocument } from "./openapi.js";

export function createDocsRouter(): Router {
  const router = Router();

  router.get("/openapi.json", (_req, res) => {
    res.json(openapiDocument);
  });

  router.use(
    "/",
    swaggerUi.serve,
    swaggerUi.setup(openapiDocument)
  );

  return router;
}