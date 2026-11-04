import { initializers } from '@dropins/tools/initializer.js';
import { getConfigValue, getHeaders } from '@dropins/tools/lib/aem/configs.js';
import { FetchGraphQL } from '@dropins/tools/fetch-graphql.js';
import { initialize, setEndpoint } from '@prakash.gurung/commerce-newsletter/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

await initializeDropin(async () => {
  // Subscriptions go to the store behind the live site's newsletter form
  // (commerce-newsletter-endpoint); without it, fall back to the core endpoint.
  const newsletterEndpoint = getConfigValue('commerce-newsletter-endpoint');
  if (newsletterEndpoint) {
    const fetchGraphQL = new FetchGraphQL();
    fetchGraphQL.setEndpoint(newsletterEndpoint);
    fetchGraphQL.setFetchGraphQlHeaders((prev) => ({ ...prev, ...getHeaders('all') }));
    setEndpoint(fetchGraphQL);
  } else {
    setEndpoint(CORE_FETCH_GRAPHQL);
  }

  // Fetch placeholders (authored in Document Authoring as placeholders/newsletter)
  const labels = await fetchPlaceholders('placeholders/newsletter.json');
  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  return initializers.mountImmediately(initialize, { langDefinitions });
})();
