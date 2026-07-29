import 'dotenv/config';
import { app } from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`Prumo API rodando em http://localhost:${env.PORT}`);
});
