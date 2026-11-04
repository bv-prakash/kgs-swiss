import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '@prakash.gurung/commerce-newsletter/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL } from '../commerce.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Core)
  setEndpoint(CORE_FETCH_GRAPHQL);

  // Every newsletter label comes from the newsletter placeholder sheet
  return initializers.mountImmediately(initialize, {
    placeholderSheet: '/placeholders/newsletter.json',
  });
})();
