import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/App';
import { Arranque } from './app/Arranque';
import { AvisoActualizacion } from './pwa/Actualizacion';
import { Aviso } from './ui/avisos';
import '../familia/familia.css';
import './styles/stoica.css';

const consultas = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false }, mutations: { retry: 0 } },
});

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <BrowserRouter>
        <Arranque>
          <App />
          <Aviso />
          <AvisoActualizacion />
        </Arranque>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
