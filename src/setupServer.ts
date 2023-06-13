import {
  Application,
  json,
  urlencoded,
  Response,
  Request,
  NextFunction,
} from "express";
import http from "http";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import cookieSession from "cookie-session";
import HTTP_STATUS from "http-status-codes";
import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import Logger from "bunyan";
import "express-async-errors";
import { config } from "./config";
import applicationRoutes from "./routes";

const SERVER_PORT = 5000;
const log: Logger = config.createLogger('server');
// Here is the Chatty Server Class
export class ChattyServer {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public start(): void {
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routeMiddleware(this.app);
    this.globalErrorHandler(this.app);
    this.startServer(this.app);
  }

  private securityMiddleware(app: Application): void {
    app.use(
      cookieSession({
        name: "session",
        keys: [
          config.SECRET_KEY_ONE!,
          config.SECRET_KEY_TWO!,
          config.SECRET_KEY_TWO!,
        ],
        // cookie will be valid for 7 days, after that it will expired
        maxAge: 24 * 7 * 3600000,
        secure: config.NODE_ENV !== "development",
      })
    );
    app.use(hpp());
    app.use(helmet());
    app.use(
      cors({
        origin: "*",
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      })
    );
  }

  private standardMiddleware(app: Application): void {
    app.use(compression());
    app.use(json({ limit: "50mb" }));
    app.use(urlencoded({ extended: true, limit: "50mb" }));
  }

  private routeMiddleware(app: Application): void {
    applicationRoutes(app);
  }

  private globalErrorHandler(app: Application): void {}

  private async startServer(app: Application): Promise<void> {
    try {
      const httpServer: http.Server = new http.Server(app);
      const socketIO: Server = await this.createSocketIO(httpServer);
      this.startHttpServer(httpServer);
      this.socketIOConnections(socketIO);
    } catch (error) {
      log.error(error);
    }
  }

  private async createSocketIO(httpServer: http.Server): Promise<Server> {
    const io: Server = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      },
    });
    const pubCLient = createClient({ url: config.REDIS_HOST });
    const subCLient = pubCLient.duplicate();
    await Promise.all([pubCLient.connect(), subCLient.connect()]);
    io.adapter(createAdapter(pubCLient, subCLient));
    return io;
  }

  private startHttpServer(httpServer: http.Server): void {
    log.info(`Server has started with process ${process.pid}`);
    httpServer.listen(SERVER_PORT, () => {
      log.info(`Server running on ${SERVER_PORT}`);
    });
  }
  private socketIOConnections(io: Server): void {}
}