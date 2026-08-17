import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import sportsRoutes from './routes/sports.js';
import careRoutes from './routes/care.js';
import eventsRoutes from './routes/events.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/sports', sportsRoutes);
app.use('/api/care', careRoutes);
app.use('/api/events', eventsRoutes);

app.use(errorHandler);

export default app;
