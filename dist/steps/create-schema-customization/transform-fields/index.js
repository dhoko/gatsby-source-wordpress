"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.transformFields = exports.returnAliasedFieldName = exports.getAliasedFieldName = void 0;

var _fieldTransformers = require("./field-transformers");

var _store = _interopRequireDefault(require("../../../store"));

var _helpers = require("../helpers");

var _defaultResolver = require("./default-resolver");

const handleCustomScalars = field => {
  const fieldTypeIsACustomScalar = field.type.kind === `SCALAR` && !(0, _helpers.typeIsASupportedScalar)(field.type);

  if (fieldTypeIsACustomScalar) {
    // if this field is an unsupported custom scalar,
    // type it as JSON
    field.type.name = `JSON`;
  }

  const fieldTypeOfTypeIsACustomScalar = field.type.ofType && field.type.ofType.kind === `SCALAR` && !(0, _helpers.typeIsASupportedScalar)(field.type);

  if (fieldTypeOfTypeIsACustomScalar) {
    // if this field is an unsupported custom scalar,
    // type it as JSON
    field.type.ofType.name = `JSON`;
  }

  return field;
}; // this is used to alias fields that conflict with Gatsby node fields
// for ex Gatsby and WPGQL both have a `parent` field


const getAliasedFieldName = ({
  fieldAliases,
  field
}) => fieldAliases && fieldAliases[field.name] ? fieldAliases[field.name] : field.name;

exports.getAliasedFieldName = getAliasedFieldName;

const returnAliasedFieldName = ({
  fieldAliases,
  field
}) => fieldAliases && fieldAliases[field.name] ? `${fieldAliases[field.name]}: ${field.name}` : field.name;

exports.returnAliasedFieldName = returnAliasedFieldName;

const excludeField = ({
  field,
  fieldName,
  thisTypeSettings,
  fieldBlacklist,
  parentTypeSettings,
  parentInterfacesImplementingTypeSettings
}) => // this field wasn't previously fetched, so we shouldn't
// add it to our schema
!(0, _helpers.fieldOfTypeWasFetched)(field.type) || parentTypeSettings.excludeFieldNames && parentTypeSettings.excludeFieldNames.includes(fieldName) || parentInterfacesImplementingTypeSettings && parentInterfacesImplementingTypeSettings.find(typeSetting => typeSetting.excludeFieldNames && typeSetting.excludeFieldNames.find(excludedFieldName => fieldName === excludedFieldName)) || // the type of this field was excluded via plugin options
thisTypeSettings.exclude || // field is blacklisted
fieldBlacklist.includes(fieldName) || field.args && field.args.find(arg => arg.type.kind === `NON_NULL`) || // this field has no typeName
!(0, _helpers.findTypeName)(field.type) || field.type.kind === `NON_NULL` && field.type.ofType.kind === `OBJECT` || field.type.kind === `NON_NULL` && field.type.ofType.kind === `ENUM`;
/**
 * Transforms fields from the WPGQL schema to work in the Gatsby schema
 * with proper node linking and type namespacing
 * also filters out unusable fields and types
 */


const transformFields = ({
  fields,
  fieldAliases,
  fieldBlacklist,
  parentType,
  parentInterfacesImplementingTypes,
  gatsbyNodeTypes
}) => {
  if (!fields || !fields.length) {
    return null;
  }

  const parentTypeSettings = (0, _helpers.getTypeSettingsByType)(parentType);
  const parentInterfacesImplementingTypeSettings = parentInterfacesImplementingTypes ? parentInterfacesImplementingTypes.map(type => (0, _helpers.getTypeSettingsByType)(type)) : null;
  const transformedFields = fields.reduce((fieldsObject, field) => {
    var _type$fields;

    // if there's no field name this field is unusable
    if (field.name === ``) {
      return fieldsObject;
    }

    const thisTypeSettings = (0, _helpers.getTypeSettingsByType)(field.type);
    const fieldName = getAliasedFieldName({
      fieldAliases,
      field
    });

    if (excludeField({
      field,
      fieldName,
      thisTypeSettings,
      fieldBlacklist,
      parentTypeSettings,
      parentInterfacesImplementingTypeSettings
    })) {
      return fieldsObject;
    }

    const {
      typeMap
    } = _store.default.getState().remoteSchema;

    const type = typeMap.get((0, _helpers.findTypeName)(field.type));
    const includedChildFields = type === null || type === void 0 ? void 0 : (_type$fields = type.fields) === null || _type$fields === void 0 ? void 0 : _type$fields.filter(field => {
      const childFieldTypeSettings = (0, _helpers.getTypeSettingsByType)(field.type);
      const fieldName = getAliasedFieldName({
        fieldAliases,
        field
      });
      return !excludeField({
        field,
        fieldName,
        thisTypeSettings: childFieldTypeSettings,
        fieldBlacklist,
        parentTypeSettings: thisTypeSettings,
        parentInterfacesImplementingTypeSettings
      });
    }); // if the child fields of this field are all excluded,
    // we shouldn't add this field
    // @todo move this to a central location.
    // if a type is missing all it's child fields due to exclusion
    // it should be globally excluded automatically.

    if (Array.isArray(includedChildFields) && !includedChildFields.length) {
      return fieldsObject;
    }

    field = handleCustomScalars(field);
    const {
      transform,
      description
    } = _fieldTransformers.fieldTransformers.find(({
      test
    }) => test(field)) || {};

    if (transform && typeof transform === `function`) {
      const transformerApi = {
        field,
        fieldsObject,
        fieldName,
        gatsbyNodeTypes,
        description
      };
      let transformedField = transform(transformerApi); // add default resolver

      if (typeof transformedField === `string`) {
        // we need to add a custom resolver to override the default resolver
        // and check for aliased fields
        // fields are aliased automatically if they have conflicting types
        // with other fields of the same name when placed in side-by-side
        // inlineFragments on the same union or interface type.
        transformedField = {
          type: transformedField,
          resolve: (0, _defaultResolver.buildDefaultResolver)(transformerApi),
          description: field.description
        };
      } else {
        transformedField.description = field.description;
      }

      fieldsObject[fieldName] = transformedField;
    }

    return fieldsObject;
  }, {});
  return transformedFields;
};

exports.transformFields = transformFields;
//# sourceMappingURL=index.js.map