import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method?: string }>();
    const response = http.getResponse<{
      getHeader?: (name: string) => number | string | string[] | undefined;
      setHeader?: (name: string, value: string) => void;
    }>();

    if (request.method === 'GET' && !response.getHeader?.('Cache-Control')) {
      response.setHeader?.('Cache-Control', 'private, max-age=0, must-revalidate');
      response.setHeader?.('Vary', 'Authorization');
    }

    return next.handle();
  }
}
