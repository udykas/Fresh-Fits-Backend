const { GraphQLServer } = require('graphql-yoga');
const Mutation = require('./resolvers/Mutation');
const Query = require('./resolvers/Query');
const db = require('./db');

//Create the GraphQL Yoga Server

function createServer() {
  return new GraphQLServer({
    schema: 'src/schema.graphql',
    resolver: {
      Mutation,
      Query
    },
    resolverValidationOptions: {
      requireResolversForResolveType: false
    },
    context: req => ({ ...req, db }),
  });
}

module.exports = createServer;