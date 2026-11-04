import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '@prakash.gurung/commerce-newsletter/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Core): subscriptions use the site's commerce endpoint
  setEndpoint(CORE_FETCH_GRAPHQL);

  // Fetch placeholders (authored in Document Authoring as placeholders/newsletter)
  const labels = await fetchPlaceholders('placeholders/newsletter.json');
  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  return initializers.mountImmediately(initialize, { langDefinitions });
})();
