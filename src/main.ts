import 'virtual:uno.css';
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { initServiceWorker } from './lib/swInit';

await initServiceWorker();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
