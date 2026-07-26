import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { StudioDataProvider } from './studio/StudioDataProvider';
import './styles/fonts.css';
import './styles/theme.css';
import './styles/tokens-extended.css';
import './styles/effects.css';
import './styles/brand.css';
import './styles/ambient.css';
import './styles/materials.css';
import './styles/spatial.css';
import './styles/app.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <StudioDataProvider>
        <AppRoutes />
      </StudioDataProvider>
    </BrowserRouter>
  </StrictMode>,
);
