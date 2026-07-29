export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (msg: string): HttpError => new HttpError(400, msg);
export const unauthorized = (msg = 'Não autorizado'): HttpError => new HttpError(401, msg);
export const notFound = (msg = 'Recurso não encontrado'): HttpError => new HttpError(404, msg);
export const conflict = (msg: string): HttpError => new HttpError(409, msg);
