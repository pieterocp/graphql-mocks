import { GraphQLSchema, GraphQLTypeResolver, GraphQLAbstractType, isUnionType } from 'graphql';
import { MirageGraphQLMapper } from '../mapper';
import { findMostInCommon, modelNameToTypeName } from './helpers';
import { extractDependencies } from '../../resolver/extract-dependencies';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mirageUnionResolver: GraphQLTypeResolver<any, any> = function (
  obj,
  context,
  _info,
  unionType: GraphQLAbstractType,
) {
  if (!isUnionType(unionType)) {
    throw new Error(
      'Expected info to be an instance of a GraphQLUnionType. This resolver can only be used as a GraphQLTypeResolver on GraphQLUnionType types',
    );
  }

  const useFindInCommon = '__testUseFindInCommon' in context ? context.__testUseFindInCommon : true;
  const { graphqlSchema } = extractDependencies<{
    graphqlSchema: GraphQLSchema;
  }>(['graphqlSchema'], context);

  const { mirageMapper } = extractDependencies<{
    mirageMapper: MirageGraphQLMapper;
  }>(['mirageMapper'], context, { required: false });

  if (!graphqlSchema) {
    throw new Error('Please include `graphqlSchema: GraphQLSchema` in your pack dependencies');
  }

  const { name } = unionType;
  const unionTypes = unionType.getTypes();

  const parentModelName = modelNameToTypeName(obj?.modelName);
  let matchingFieldsCandidate;
  let matchingFieldsCandidateError;

  try {
    matchingFieldsCandidate = useFindInCommon ? findMostInCommon(obj, unionTypes) : undefined;
  } catch (error) {
    matchingFieldsCandidateError = error;
  }

  const mappedModelName = mirageMapper && parentModelName && mirageMapper.findMatchForModel(parentModelName);
  const candidates = [mappedModelName, parentModelName, matchingFieldsCandidate].filter(Boolean);
  const match = candidates.find((candidate) => graphqlSchema.getType(candidate as string));

  if (!match) {
    const matchingFieldsError = matchingFieldsCandidateError
      ? `Was also unable to find automatically determine the type based on matching fields: ${matchingFieldsCandidateError.message}`
      : '';
    const triedCandidates = candidates.join(', ');

    throw new Error(
      `Unable to find a matching type for resolving union ${name}, checked in ${triedCandidates}. ${matchingFieldsError}`,
    );
  }

  return match;
};
