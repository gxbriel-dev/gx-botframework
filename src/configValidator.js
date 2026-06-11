function getType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateField(keyPath, rules, value) {
  const errors = [];
  const actualType = getType(value);

  if (value === undefined || value === null) {
    if (rules.required) {
      errors.push(`${keyPath} ist erforderlich.`);
    }
    return errors;
  }

  if (rules.type && actualType !== rules.type) {
    errors.push(`${keyPath} muss vom Typ ${rules.type} sein (ist ${actualType}).`);
  }

  if (rules.enum && !rules.enum.includes(value)) {
    errors.push(`${keyPath} muss einer von [${rules.enum.join(', ')}] sein.`);
  }

  return errors;
}

function walkSchema(node, data, keyPath = '', errors = []) {
  for (const [key, rules] of Object.entries(node)) {
    const currentPath = keyPath ? `${keyPath}.${key}` : key;
    const value = data ? data[key] : undefined;

    if (rules.type && !rules.enum) {
      errors.push(...validateField(currentPath, rules, value));
      continue;
    }

    if (rules.type === undefined && typeof rules === 'object') {
      walkSchema(rules, value || {}, currentPath, errors);
    }
  }

  return errors;
}

function applyDefaults(node, data = {}) {
  const result = { ...data };

  for (const [key, rules] of Object.entries(node)) {
    if (rules.type && !rules.enum) {
      if (result[key] === undefined && rules.default !== undefined) {
        result[key] = rules.default;
      }
      continue;
    }

    if (rules.type === undefined && typeof rules === 'object') {
      result[key] = applyDefaults(rules, result[key] || {});
    }
  }

  return result;
}

function validateConfig(schema, config) {
  const errors = walkSchema(schema, config);
  return {
    valid: errors.length === 0,
    errors,
  };
}

function withDefaults(schema, config) {
  return applyDefaults(schema, config);
}

module.exports = {
  validateConfig,
  withDefaults,
};
