const {expect} = require('chai');
const fs = require('fs-extra');
const path = require('path');
const err = require('./errors.js');
const mdl = require('shr-models');

function commonExportTests(exportFn, expectedFn, expectedErrorsFn, fixFn, resultsPath, clean=true) {
  if (typeof expectedErrorsFn === 'undefined') {
    // default to expecting no errors
    expectedErrorsFn = function() { return []; };
  }

  if (resultsPath) {
    if (clean) {
      fs.removeSync(resultsPath);
    }
    fs.mkdirpSync(resultsPath);
  }

  const wrappedExpectedFns = function(name, testCase) {
    try {
      return {
        name,
        result: expectedFn(name),
        errors: expectedErrorsFn(name)
      };
    } catch (e) {
      if (e instanceof Error && e.name === 'AssertionError') {
        throw e;
      }
      const msg = `Skipping ${name} test.  Failed to load expected values/errors: ${e}`;
      console.warn(msg);
      testCase.skip(msg);
    }
  };

  return () => {
    let _specs;
    let checkExpected = function(expected) {
      let result;
      try {
        result = exportFn(_specs);
        if (resultsPath) {
          // Write out the actual results to the specified path
          const ext = typeof result === 'object' ? 'json' : 'txt';
          fs.writeFileSync(path.join(resultsPath, `${expected.name}.${ext}`), JSON.stringify(result, null, 2));
        }
        expect(result).to.eql(expected.result);
      } catch (ex) {
        if (err.errors().length) {
          console.error('Test failed, additional errors that occurred while executing the test are', err.errors());
          fs.writeFileSync(path.join(resultsPath, `${expected.name}_errors.json`), JSON.stringify(err.errors(), null, 2));
        }
        if (typeof fixFn === 'function') {
          fixFn(expected.name, result, err.errors());
        }
        throw ex;
      }
      if (err.hasErrors() && resultsPath) {
        fs.writeFileSync(path.join(resultsPath, `${expected.name}_errors.json`), JSON.stringify(err.errors(), null, 2));
      }
      try {
        if (err.errors().length !== expected.errors.length) {
          expect(err.errors()).to.deep.equal(expected.errors);
        }
        for (let i=0; i < expected.errors.length; i++) {
          const expErr = expected.errors[i];
          const actErr = err.errors()[i];
          // The expErr will be a subset of the actErr, so just check the keys in expErr
          for (const key of Object.keys(expErr)) {
            expect(actErr[key]).to.eql(expErr[key]);
          }
        }
      } catch (e) {
        if (typeof fixFn === 'function') {
          fixFn(expected.name, null, err.errors());
        }
        throw e;
      }
    };

    // Note: using ES5 function syntax instead of () => due to bug in mocha that doesn't preserve context of 'this'
    beforeEach(function() {
      _specs = new mdl.Specifications();
      err.clear();
    });

    afterEach(function() {
      _specs = null;
    });

    it('should correctly export a simple entry', function() {
      addSimpleElement(_specs, 'shr.test');
      const expected = wrappedExpectedFns('Simple', this);
      checkExpected(expected);
    });

    it('should correctly export a simple entry in a different namespace', function() {
      addSimpleElement(_specs, 'shr.other.test');
      const expected = wrappedExpectedFns('ForeignSimple', this);
      checkExpected(expected);
    });

    it('should correctly export a coded entry', function() {
      addCodedElement(_specs, 'shr.test');
      const expected = wrappedExpectedFns('Coded', this);
      checkExpected(expected);
    });

    it('should correctly export a reference entry', function() {
      addSimpleReference(_specs, 'shr.test');
      const expected = wrappedExpectedFns('SimpleReference', this);
      checkExpected(expected);
    });

    it('should correctly export a choice of references', function() {
      addReferenceChoice(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('ReferenceChoice', this);
      checkExpected(expected);
    });

    it('should correctly export an entry with an element value', function() {
      // NOTE: This is an entry where the value is not a primitive, e.g. "Value: SomeOtherDataElement"
      addElementValue(_specs, 'shr.test');
      const expected = wrappedExpectedFns('ElementValue', this);
      checkExpected(expected);
    });

    it('should correctly export an entry with an element value in a different namespace', function() {
      // NOTE: This is an entry where the value is not a primitive, e.g. "Value: SomeOtherDataElement"
      addForeignElementValue(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('ForeignElementValue', this);
      checkExpected(expected);
    });

    it('should correctly export an entry with two-deep element value', function() {
      // NOTE: This is an entry where the value is a non-primitive, that itself has a value that is a non-primitive
      addTwoDeepElementValue(_specs, 'shr.test');
      const expected = wrappedExpectedFns('TwoDeepElementValue', this);
      checkExpected(expected);
    });

    it('should correctly export a choice', function() {
      addChoice(_specs, 'shr.test');
      const expected = wrappedExpectedFns('Choice', this);
      checkExpected(expected);
    });

    it('should correctly export a choice containing a choice', function() {
      addChoiceOfChoice(_specs, 'shr.test');
      const expected = wrappedExpectedFns('ChoiceOfChoice', this);
      checkExpected(expected);
    });

    it('should correctly export a group', function() {
      addGroup(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('Group', this);
      checkExpected(expected);
    });

    it('should correctly export a group with a choice containing a choice', function() {
      addGroupWithChoiceOfChoice(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('GroupWithChoiceOfChoice', this);
      checkExpected(expected);
    });

    it('should correctly export a group with name clashes', function() {
      addGroupPathClash(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('GroupPathClash', this);
      checkExpected(expected);
    });

    it('should correctly export an element based on a group element', function() {
      addGroupDerivative(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('GroupDerivative', this);
      checkExpected(expected);
    });

    it('tbd value and fields', function() {
      addTBDElement(_specs, 'shr.test');
      const expected = wrappedExpectedFns('NotDone', this);
      checkExpected(expected);
    });

    it('tbd inheritance', function() {
      addTBDElementDerivative(_specs, 'shr.test');
      const expected = wrappedExpectedFns('NotDoneDerivative', this);
      checkExpected(expected);
    });

    it('abstract and non-entry elements', function() {
      addAbstractAndPlainElements(_specs, 'shr.test');
      const expected = wrappedExpectedFns('AbstractAndPlainGroup', this);
      checkExpected(expected);
    });

    it('should correctly export elements with nested cardinality constraints', function() {
      addNestedCardConstrainedElement(_specs, 'shr.test');
      const expected = wrappedExpectedFns('NestedCardConstraint', this);
      checkExpected(expected);
    });
    it('should correctly export elements with nested cardinality constraints on lists', function() {
      addNestedListCardConstrainedElements(_specs, 'shr.test');
      const expected = wrappedExpectedFns('NestedListCardConstraints', this);
      checkExpected(expected);
    });
    it('should correctly export elements with type constraints', function() {
      addTypeConstrainedElements(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('TypeConstraints', this);
      checkExpected(expected);
    });
    it('should correctly export nested elements with type constraints', function() {
      addTypeConstrainedElementsWithPath(_specs, 'shr.test');
      const expected = wrappedExpectedFns('TypeConstraintsWithPath', this);
      checkExpected(expected);
    });
    it('should correctly export choices with type constraints', function() {
      addTypeConstrainedChoices(_specs, 'shr.test');
      const expected = wrappedExpectedFns('TypeConstrainedChoices', this);
      checkExpected(expected);
    });
    it('should correctly export type constraints on references', function() {
      addTypeConstrainedReference(_specs, 'shr.test');
      const expected = wrappedExpectedFns('TypeConstrainedReference', this);
      checkExpected(expected);
    });

    it('should correctly export includes type constraints', function() {
      addIncludesTypeConstraints(_specs, 'shr.test');
      const expected = wrappedExpectedFns('IncludesTypeConstraints', this);
      checkExpected(expected);
    });

    it('should correctly export includes type constraints set on a field\'s value', function() {
      addOnValueIncludesTypeConstraints(_specs, 'shr.test');
      const expected = wrappedExpectedFns('OnValueIncludesTypeConstraints', this);
      checkExpected(expected);
    });

    it('should correctly export nested includes type constraints', function() {
      addNestedIncludesTypeConstraints(_specs, 'shr.test');
      const expected = wrappedExpectedFns('NestedIncludesTypeConstraints', this);
      checkExpected(expected);
    });

    it('should correctly export includes type constraints with a zeroed out include type', function() {
      addIncludesTypeConstraintsWithZeroedOutType(_specs, 'shr.test');
      const expected = wrappedExpectedFns('IncludesTypeConstraintsZeroedOut', this);
      checkExpected(expected);
    });

    it('should correctly export includes code constraints', function() {
      addIncludesCodeConstraints(_specs, 'shr.test');
      const expected = wrappedExpectedFns('IncludesCodeConstraints', this);
      checkExpected(expected);
    });

    it('should correctly export nested includes code constraints', function() {
      addNestedIncludesCodeConstraints(_specs, 'shr.test');
      const expected = wrappedExpectedFns('NestedIncludesCodeConstraints', this);
      checkExpected(expected);
    });

    it('should correctly export an element with nested valueset constraints', function() {
      addValueSetConstraints(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('NestedValueSetConstraints', this);
      checkExpected(expected);
    });

    it('should correctly export an element with valueset constraints on a choice', function() {
      addValueSetChoiceConstraints(_specs, 'shr.test');
      const expected = wrappedExpectedFns('ChoiceValueSetConstraint', this);
      checkExpected(expected);
    });

    it('should correctly export an element with boolean and code constraints', function() {
      addConstConstraints(_specs, 'shr.test', 'shr.other.test');
      const expected = wrappedExpectedFns('BooleanAndCodeConstraints', this);
      checkExpected(expected);
    });

    it('should correctly export an element with code constraints', function() {
      addFixedCodeExtravaganza(_specs, 'shr.test');
      const expected = wrappedExpectedFns('FixedCodeExtravaganza', this);
      checkExpected(expected);
    });
  };
}

function addGroup(specs, ns, otherNS, addSubElements=true) {
  let gr = new mdl.DataElement(id(ns, 'Group'))
    .withDescription('It is a group of elements')
    .withConcept(new mdl.Concept('http://foo.org', 'bar', 'Foobar'))
    .withConcept(new mdl.Concept('http://boo.org', 'far', 'Boofar'))
    .withField(new mdl.IdentifiableValue(id('shr.test', 'Simple')).withMinMax(1, 1))
    .withField(new mdl.IdentifiableValue(id('shr.test', 'Coded')).withMinMax(0, 1))
    .withField(new mdl.IdentifiableValue(id('shr.test', 'ElementValue')).withMinMax(0));
  add(specs, gr);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addCodedElement(specs, ns);
    addSimpleElement(specs, otherNS);
    addForeignElementValue(specs, ns, otherNS);
    addElementValue(specs, ns);
  }
  return gr;
}

function addGroupWithChoiceOfChoice(specs, ns, otherNS, addSubElements=true) {
  let gr = new mdl.DataElement(id(ns, 'GroupWithChoiceOfChoice'))
    .withValue(new mdl.ChoiceValue().withMinMax(0,2)
      .withOption(new mdl.IdentifiableValue(id('shr.other.test', 'Simple')).withMinMax(1, 1))
      .withOption(new mdl.ChoiceValue().withMinMax(1, 1)
        .withOption(new mdl.IdentifiableValue(id('shr.test', 'ForeignElementValue')).withMinMax(1, 1))
        .withOption(new mdl.IdentifiableValue(id('shr.test', 'ElementValue')).withMinMax(1, 1))
      ))
    .withDescription('It is a group of elements with a choice containing a choice')
    .withField(new mdl.IdentifiableValue(id('shr.test', 'Simple')).withMinMax(1, 1))
    .withField(new mdl.IdentifiableValue(id('shr.test', 'Coded')).withMinMax(0, 1));
  add(specs, gr);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addCodedElement(specs, ns);
    addSimpleElement(specs, otherNS);
    addForeignElementValue(specs, ns, otherNS);
    addElementValue(specs, ns);
  }
  return gr;
}

function addGroupPathClash(specs, ns, nsOther, addSubElements=true) {
  let gr = new mdl.DataElement(id(ns, 'GroupPathClash'))
    .withDescription('It is a group of elements with clashing names')
    .withField(new mdl.IdentifiableValue(id('shr.test', 'Simple')).withMinMax(1, 1))
    .withField(new mdl.IdentifiableValue(id('shr.other.test', 'Simple')).withMinMax(0, 1));
  add(specs, gr);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addSimpleElement(specs, nsOther);
  }
  return gr;
}

function addGroupDerivative(specs, ns, otherNS, addSubElements=true) {
  let gd = new mdl.DataElement(id(ns, 'GroupDerivative'))
    .withBasedOn(id('shr.test', 'Group'))
    .withDescription('It is a derivative of a group of elements')
    .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1));
  add(specs, gd);
  if (addSubElements) {
    addGroup(specs, ns, otherNS, addSubElements);
  }
  return gd;
}

function addSimpleElement(specs, ns, isEntry=false) {
  let de = new mdl.DataElement(id(ns, 'Simple'), isEntry)
    .withDescription('It is a simple element')
    .withConcept(new mdl.Concept('http://foo.org', 'bar', 'Foobar'))
    .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1));
  add(specs, de);
  return de;
}

function addSimpleEntry(specs, ns) {
  return addSimpleElement(specs, ns, true);
}

function addCodedElement(specs, ns, isEntry=false) {
  let de = new mdl.DataElement(id(ns, 'Coded'), isEntry)
    .withDescription('It is a coded element')
    .withValue(new mdl.IdentifiableValue(pid('concept')).withMinMax(1, 1)
      .withConstraint(new mdl.ValueSetConstraint('http://standardhealthrecord.org/test/vs/Coded'))
    );
  add(specs, de);
  return de;
}

function addCodedEntry(specs, ns) {
  return addCodedElement(specs, ns, true);
}

function addSimpleReference(specs, ns, addSubElement=true) {
  let de = new mdl.DataElement(id(ns, 'SimpleReference'))
    .withDescription('It is a reference to a simple element')
    .withValue(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(1, 1)); // Reference to Entry
  add(specs, de);
  if (addSubElement) {
    addSimpleEntry(specs, ns);
  }
  return de;
}

function addReferenceChoice(specs, ns, otherNS, addSubElement=true) {
  let ch = new mdl.DataElement(id(ns, 'ReferenceChoice'))
      .withDescription('It is a reference to one of a few types')
      .withValue(new mdl.ChoiceValue().withMinMax(1, 1)
          .withOption(new mdl.IdentifiableValue(id(otherNS, 'Simple')).withMinMax(1, 1)) // Reference to Entry
          .withOption(new mdl.IdentifiableValue(id(ns, 'Coded')).withMinMax(1, 1)) // Reference to Entry
      );
  add(specs, ch);
  if (addSubElement) {
    addSimpleEntry(specs, otherNS);
    addCodedEntry(specs, ns);
  }
  return ch;
}

function addTwoDeepElementValue(specs, ns, addSubElement=true) {
  let de = new mdl.DataElement(id(ns, 'TwoDeepElementValue'))
    .withDescription('It is an element with a two-deep element value')
    .withValue(new mdl.IdentifiableValue(id(ns, 'ElementValue')).withMinMax(1, 1));
  add(specs, de);
  if (addSubElement) {
    addElementValue(specs, ns, true);
  }
  return de;
}

function addElementValue(specs, ns, addSubElement=true) {
  let de = new mdl.DataElement(id(ns, 'ElementValue'))
    .withDescription('It is an element with an element value')
    .withValue(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(1, 1));
  add(specs, de);
  if (addSubElement) {
    addSimpleElement(specs, ns);
  }
  return de;
}

function addForeignElementValue(specs, ns, otherNS) {
  let de = new mdl.DataElement(id(ns, 'ForeignElementValue'))
    .withDescription('It is an element with a foreign element value')
    .withValue(new mdl.IdentifiableValue(id(otherNS, 'Simple')).withMinMax(1, 1));
  add(specs, de);
  addSimpleElement(specs, otherNS);
  return de;
}

function addChoice(specs, ns, addSubElements=true) {
  let ch = new mdl.DataElement(id(ns, 'Choice'))
    .withDescription('It is an element with a choice')
    .withValue(new mdl.ChoiceValue().withMinMax(1, 1)
      .withOption(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1))
      .withOption(new mdl.IdentifiableValue(pid('concept')).withMinMax(1, 1)
        .withConstraint(new mdl.ValueSetConstraint('http://standardhealthrecord.org/test/vs/CodeChoice'))
      )
      .withOption(new mdl.IdentifiableValue(id('shr.test', 'Coded')).withMinMax(1, 1))
    );
  add(specs, ch);
  if (addSubElements) {
    addCodedElement(specs, ns);
  }
  return ch;
}

function addChoiceOfChoice(specs, ns) {
  let de = new mdl.DataElement(id(ns, 'ChoiceOfChoice'))
    .withDescription('It is an element with a choice containing a choice')
    .withValue(new mdl.ChoiceValue().withMinMax(1, 1)
      .withOption(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1))
      .withOption(new mdl.ChoiceValue().withMinMax(1, 1)
        .withOption(new mdl.IdentifiableValue(pid('integer')).withMinMax(1, 1))
        .withOption(new mdl.IdentifiableValue(pid('decimal')).withMinMax(1, 1))
      )
      .withOption(new mdl.IdentifiableValue(pid('concept')).withMinMax(1, 1)
        .withConstraint(new mdl.ValueSetConstraint('http://standardhealthrecord.org/test/vs/CodeChoice'))
      )
    );
  add(specs, de);
  return de;
}

function addTBDElement(specs, ns) {
  let de = new mdl.DataElement(id(ns, 'NotDone'))
      .withDescription('It is an unfinished element')
      .withConcept(new mdl.Concept('http://foo.org', 'bar', 'Foobar'))
      .withValue(new mdl.TBD('An undetermined value.').withMinMax(1, 1))
      .withField(new mdl.TBD('An undetermined list field.').withMinMax(0))
      .withField(new mdl.TBD('An undetermined singular field.').withMinMax(1, 1))
      .withField(new mdl.TBD().withMinMax(1));
  add(specs, de);
  return de;
}

function addTBDElementDerivative(specs, ns, addSubElements=true) {
  let de = new mdl.DataElement(id(ns, 'NotDoneDerivative'))
      .withBasedOn(new mdl.TBD('An undetermined parent.'))
      .withBasedOn(new mdl.TBD())
      .withBasedOn(id('shr.test', 'ValuelessElement'))
      .withDescription('It is an unfinished derivative element')
      .withConcept(new mdl.TBD('Not sure of the concept'))
      .withValue(new mdl.TBD('An undetermined list value.').withMinMax(0))
      .withField(new mdl.TBD('An undetermined singular field.').withMinMax(1, 1));
  add(specs, de);
  if (addSubElements) {
    add(specs, new mdl.DataElement(id(ns, 'ValuelessElement'))
        .withDescription('An element with no value.')
        .withField(new mdl.IdentifiableValue(id('shr.test', 'Simple')).withMinMax(1, 1)));
    addSimpleElement(specs, ns);
  }
  return de;
}

function addAbstractAndPlainElements(specs, ns, addSubElements=true) {
  let gr = new mdl.DataElement(id(ns, 'AbstractAndPlainGroup'), false, true)
      .withDescription('It is an abstract group of elements')
      .withConcept(new mdl.Concept('http://foo.org', 'bar', 'Foobar'))
      .withField(new mdl.IdentifiableValue(id('shr.test', 'Simple')).withMinMax(1, 1))
      .withField(new mdl.IdentifiableValue(id('shr.test', 'Plain')).withMinMax(1, 1));
  add(specs, gr);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    add(specs, new mdl.DataElement(id(ns, 'Plain'))
        .withDescription('It is not an entry element')
        .withConcept(new mdl.Concept('http://foo.org', 'bar', 'Foobar'))
        .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1)));
  }
  return gr;
}

function addNestedCardConstrainedElement(specs, ns, addSubElements=true) {
  let ov = new mdl.DataElement(id(ns, 'OptionalValue'))
    .withDescription('An element with an optional value.')
    .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(0, 1));
  let of = new mdl.DataElement(id(ns, 'OptionalField'))
    .withDescription('An element with an optional field.')
    .withField(new mdl.IdentifiableValue(id(ns, 'OptionalValue')).withMinMax(0, 1));
  let de = new mdl.DataElement(id(ns, 'NestedCardConstraint'))
      .withDescription('It has a field with a nested card constraint.')
      .withField(new mdl.IdentifiableValue(id(ns, 'OptionalField'))
        .withMinMax(1, 1)
        .withConstraint(new mdl.CardConstraint(new mdl.Cardinality(1, 1), [id(ns, 'OptionalValue')])));
  add(specs, ov, of, de);
  return de;
}

function addNestedListCardConstrainedElements(specs, ns, addSubElements=true) {
  let ov = new mdl.DataElement(id(ns, 'OptionalList'))
      .withDescription('An element with an optional list.')
      .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(0));
  let of = new mdl.DataElement(id(ns, 'ListField'))
      .withDescription('An element with a list field.')
      .withField(new mdl.IdentifiableValue(id(ns, 'OptionalList')).withMinMax(1, 1));
  let de = new mdl.DataElement(id(ns, 'NestedListCardConstraints'))
      .withDescription('It has a field with a nested card constraint on a list.')
      .withField(new mdl.IdentifiableValue(id(ns, 'ListField'))
          .withMinMax(1, 1)
          .withConstraint(new mdl.CardConstraint(new mdl.Cardinality(2, 10), [id(ns, 'OptionalList'), pid('string')])));
  add(specs, ov, of, de);
  return de;
}

function addTypeConstrainedElements(specs, ns, otherNS, addSubElements=true) {
  addSimpleChildElement(specs, ns);
  let gd = new mdl.DataElement(id(ns, 'GroupDerivative'))
      .withBasedOn(id('shr.test', 'Group'))
      .withDescription('It is a derivative of a group of elements with type constraints.')
      .withField(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(1, 1).withConstraint(new mdl.TypeConstraint(id(ns, 'SimpleChild'))))
      .withField(new mdl.IdentifiableValue(id(ns, 'ElementValue')).withMinMax(0).withConstraint(new mdl.TypeConstraint(id(ns, 'SimpleChild'), undefined, true)));
  add(specs, gd);
  if (addSubElements) {
    addGroup(specs, ns, otherNS, addSubElements);
  }
  return gd;
}

function addTypeConstrainedElementsWithPath(specs, ns, addSubElements=true) {
  let ef = new mdl.DataElement(id(ns, 'ElementField'))
      .withDescription('It is an element with a field.')
      .withField(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(1, 1));
  let td = new mdl.DataElement(id(ns, 'TwoDeepElementField'))
      .withDescription('It is an element with a two-deep element field')
      .withField(new mdl.IdentifiableValue(id(ns, 'ElementField')).withMinMax(1, 1));
  let nf = new mdl.DataElement(id(ns, 'NestedField'))
      .withDescription('It is an element with a nested field.')
      .withField(new mdl.IdentifiableValue(id(ns, 'TwoDeepElementField')).withMinMax(0, 1));
  let cp = new mdl.DataElement(id(ns, 'ConstrainedPath'))
      .withBasedOn(id('shr.test', 'NestedField'))
      .withDescription('It derives an element with a nested field.')
      .withField(new mdl.IdentifiableValue(id(ns, 'TwoDeepElementField')).withMinMax(0, 1).withConstraint(new mdl.TypeConstraint(id(ns, 'SimpleChild'), [id(ns, 'ElementField'), id(ns, 'Simple')])));
  let cpni = new mdl.DataElement(id(ns, 'ConstrainedPathNoInheritance'))
      .withDescription('It has a new field with a nested constraint.')
      .withField(new mdl.IdentifiableValue(id(ns, 'TwoDeepElementField')).withMinMax(0, 1).withConstraint(new mdl.TypeConstraint(id(ns, 'SimpleChild'), [id(ns, 'ElementField'), id(ns, 'Simple')])));
  add(specs, ef, td, nf, cp, cpni);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addSimpleChildElement(specs, ns);
  }
  return cp;
}

function addTypeConstrainedChoices(specs, ns, addSubElements=true) {
  let tcc = new mdl.DataElement(id(ns, 'TypeConstrainedChoice'))
    .withDescription('It is an element with a choice with a constraint.')
    .withField(new mdl.IdentifiableValue(id(ns, 'Choice')).withMinMax(1, 1)
      .withConstraint(new mdl.TypeConstraint(pid('string')).withOnValue(true))
    );
  let cv = new mdl.DataElement(id(ns, 'ChoiceValue'))
    .withDescription('It is an element with a choice value.')
    .withValue(new mdl.IdentifiableValue(id(ns, 'Choice')).withMinMax(1, 1));
  let td = new mdl.DataElement(id(ns, 'TwoDeepChoiceField'))
    .withDescription('It is an element with a a field with a choice.')
    .withField(new mdl.IdentifiableValue(id(ns, 'ChoiceValue')).withMinMax(0, 1));
  let tccp = new mdl.DataElement(id(ns, 'TypeConstrainedChoiceWithPath'))
    .withDescription('It is an element with a choice on a field with a constraint.')
    .withField(new mdl.IdentifiableValue(id(ns, 'TwoDeepChoiceField')).withMinMax(0, 1)
      .withConstraint(new mdl.TypeConstraint(id(ns, 'Coded'), [id(ns, 'ChoiceValue'), id(ns, 'Choice')], true))
    );
  add(specs, tcc, cv, td, tccp);
  if (addSubElements) {
    addChoice(specs, ns);
  }
  return tccp;
}

function addTypeConstrainedReference(specs, ns, addSubElements=true) {
  let de = new mdl.DataElement(id(ns, 'TypeConstrainedReference'))
    .withBasedOn(id(ns, 'SimpleReference'))
    .withDescription('It is an element a constraint on a reference.')
    .withValue(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(1, 1) // Reference to Entry
      .withConstraint(new mdl.TypeConstraint(id(ns, 'SimpleChild'))));
  add(specs, de);
  if (addSubElements) {
    addSimpleEntry(specs, ns);
    addSimpleChildEntry(specs, ns);
    addSimpleReference(specs, ns);
  }
  return de;
}

function addIncludesTypeConstraints(specs, ns, addSubElements=true) {
  let sc2 = new mdl.DataElement(id(ns, 'SimpleChild2'))
      .withBasedOn(id(ns, 'Simple'))
      .withDescription('A derivative of the simple type.')
      .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1));
  let de = new mdl.DataElement(id(ns, 'IncludesTypesList'))
      .withDescription('An entry with a includes types constraints.')
      .withValue(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(0)
          .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild'), new mdl.Cardinality(0, 1)))
          .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild2'), new mdl.Cardinality(0, 2)))
  );
  add(specs, sc2);
  add(specs, de);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addSimpleChildElement(specs, ns);
  }
  return de;
}

function addIncludesTypeConstraintsWithZeroedOutType(specs, ns, addSubElements=true) {
  let sc2 = new mdl.DataElement(id(ns, 'SimpleChild2'))
      .withBasedOn(id(ns, 'Simple'))
      .withDescription('A derivative of the simple type.')
      .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1));
  let de = new mdl.DataElement(id(ns, 'IncludesTypesListWithZeroedOutType'))
      .withDescription('An entry with a includes types constraints.')
      .withValue(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(0)
          .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild'), new mdl.Cardinality(0, 1)))
          .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild2'), new mdl.Cardinality(0, 0)))
  );
  add(specs, sc2);
  add(specs, de);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addSimpleChildElement(specs, ns);
  }
  return de;
}

function addOnValueIncludesTypeConstraints(specs, ns, addSubElements=true) {
  let evl = new mdl.DataElement(id(ns, 'ElementValueList'), false, false)
      .withDescription('It is an element with a value that is a list of elements')
      .withValue(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(0));
  let sc2 = new mdl.DataElement(id(ns, 'SimpleChild2'))
      .withBasedOn(id(ns, 'Simple'))
      .withDescription('A derivative of the simple type.')
      .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1));
  let de = new mdl.DataElement(id(ns, 'OnValueIncludesTypeConstraints'))
      .withDescription('An entry with includes types constraints that are on the value of the field.')
      .withField(new mdl.IdentifiableValue(id(ns, 'ElementValueList')).withMinMax(0, 1)
        .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild'), new mdl.Cardinality(0, 1), [], true))
        .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild2'), new mdl.Cardinality(0, 2), [], true))
  );
  add(specs, evl, sc2, de);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addSimpleChildElement(specs, ns);
  }
  return de;
}

function addNestedIncludesTypeConstraints(specs, ns, addSubElements=true) {
  let efl = new mdl.DataElement(id(ns, 'ElementFieldList'), false, false)
      .withDescription('It is an element with a field that is a list of elements')
      .withField(new mdl.IdentifiableValue(id(ns, 'Simple')).withMinMax(0));
  let eflc = new mdl.DataElement(id(ns, 'ElementFieldListContainer'), false, false)
      .withDescription('It is an element with a field that contains an element with a field that is a list of elements')
      .withField(new mdl.IdentifiableValue(id(ns, 'ElementFieldList')).withMinMax(0,1));
  let sc2 = new mdl.DataElement(id(ns, 'SimpleChild2'))
      .withBasedOn(id(ns, 'Simple'))
      .withDescription('A derivative of the simple type.')
      .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1));
  let de = new mdl.DataElement(id(ns, 'NestedIncludesTypeConstraints'))
      .withDescription('An entry with includes types constraints that are on a nested field.')
      .withField(new mdl.IdentifiableValue(id(ns, 'ElementFieldListContainer')).withMinMax(0, 1)
        .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild'), new mdl.Cardinality(0, 1), [id(ns, 'ElementFieldList'), id(ns, 'Simple')], false))
        .withConstraint(new mdl.IncludesTypeConstraint(id(ns, 'SimpleChild2'), new mdl.Cardinality(0, 2), [id(ns, 'ElementFieldList'), id(ns, 'Simple')], false))
  );
  add(specs, efl, eflc, sc2, de);
  if (addSubElements) {
    addSimpleElement(specs, ns);
    addSimpleChildElement(specs, ns);
  }
  return de;
}

function addIncludesCodeConstraints(specs, ns) {
  let de = new mdl.DataElement(id(ns, 'IncludesCodesList'))
    .withDescription('An entry with a includes codes constraint.')
    .withValue(new mdl.IdentifiableValue(pid('concept')).withMinMax(0)
      .withConstraint(new mdl.IncludesCodeConstraint(new mdl.Concept('http://foo.org', 'bar', 'Foobar')))
      .withConstraint(new mdl.IncludesCodeConstraint(new mdl.Concept('http://boo.org', 'far', 'Boofar')))
    );
  add(specs, de);
  return de;
}

function addNestedIncludesCodeConstraints(specs, ns, addSubElements=true) {
  // NOTE: This tests a suspicious use case, as the includes code resolves to a 1..1 code.  It's the code's parent
  // that is actually a list -- so the iteration happens one level up.  This test is here because it reflects a real
  // use case in actual SHR definitions.
  let de = new mdl.DataElement(id(ns, 'NestedIncludesCodes'))
    .withDescription('An entry with a nested includes codes constraint.')
    .withValue(new mdl.IdentifiableValue(id('shr.test', 'Coded')).withMinMax(0)
      .withConstraint(new mdl.IncludesCodeConstraint(new mdl.Concept('http://foo.org', 'bar', 'Foobar'), [pid('concept')]))
      .withConstraint(new mdl.IncludesCodeConstraint(new mdl.Concept('http://boo.org', 'far', 'Boofar'), [pid('concept')]))
    );
  add(specs, de);
  if (addSubElements) {
    addCodedElement(specs, ns);
  }
  return de;
}

function addValueSetConstraints(specs, ns, otherNS, addSubElements=true) {
  let gd = new mdl.DataElement(id(ns, 'NestedValueSetConstraints'))
      .withBasedOn(id('shr.test', 'Group'))
      .withDescription('It has valueset constraints on a field.')
      .withField(new mdl.IdentifiableValue(id('shr.test', 'Coded')).withMinMax(0, 1)
        .withConstraint(new mdl.ValueSetConstraint('http://standardhealthrecord.org/test/vs/Coded2', [pid('concept')]).withBindingStrength(mdl.REQUIRED))
  );
  add(specs, gd);
  if (addSubElements) {
    addGroup(specs, ns, otherNS, addSubElements);
  }
  return gd;
}

function addValueSetChoiceConstraints(specs, ns, addSubElements=true) {
  let cc = new mdl.DataElement(id(ns, 'CodedChoice'))
    .withDescription('An element with a choice of code fields.')
    .withValue(new mdl.ChoiceValue().withMinMax(0, 1)
      .withOption(new mdl.IdentifiableValue(id(ns, 'Coded')).withMinMax(1, 1))
      .withOption(new mdl.IdentifiableValue(pid('concept')).withMinMax(1, 1))
    );
  let de = new mdl.DataElement(id(ns, 'ChoiceValueSetConstraint'))
    .withDescription('It has valueset constraints on a choice field.')
    .withField(new mdl.IdentifiableValue(id(ns, 'CodedChoice')).withMinMax(0, 1)
      .withConstraint(new mdl.ValueSetConstraint('http://standardhealthrecord.org/test/vs/Coded2', [pid('concept')]).withBindingStrength(mdl.PREFERRED))
    );
  add(specs, cc, de);
  if (addSubElements) {
    addCodedElement(specs, ns);
  }
  return de;
}

function addConstConstraints(specs, ns, otherNS, addSubElements=true) {
  let bl = new mdl.DataElement(id(ns, 'Bool'), false)
    .withDescription('A boolean element.')
      .withValue(new mdl.IdentifiableValue(pid('boolean')).withMinMax(0, 1));
  let cc = new mdl.DataElement(id(ns, 'BooleanAndCodeConstraints'))
    .withBasedOn(id('shr.test', 'Group'))
    .withDescription('It has boolean and code constraints.')
    .withValue(new mdl.IdentifiableValue(pid('boolean')).withMinMax(1, 1).withConstraint(new mdl.BooleanConstraint(true)))
    .withField(new mdl.IdentifiableValue(id(ns, 'Coded')).withMinMax(0, 1)
      .withConstraint(new mdl.CodeConstraint(new mdl.Concept('http://foo.org', 'bar', 'Foobar'), [pid('concept')])))
    .withField(new mdl.IdentifiableValue(id(ns, 'Bool')).withMinMax(0, 1)
      .withConstraint(new mdl.BooleanConstraint(false)));

  add(specs, bl, cc);
  if (addSubElements) {
    addGroup(specs, ns, otherNS, addSubElements);
  }
  return cc;
}

function addFixedCodeExtravaganza(specs, ns, addSubElements=true) {
  // NOTE: This is considerably less interesting w/ the elimination of Coding and CodeableConcept
  const fce = new mdl.DataElement(id(ns, 'FixedCodeExtravaganza'), false, false)
    .withDescription('An element with all sorts of fixed codes.')
    .withValue(new mdl.ChoiceValue().withMinMax(0, 1)
      .withOption(new mdl.IdentifiableValue(pid('Coded')).withMinMax(1, 1)
        .withConstraint(new mdl.CodeConstraint(new mdl.Concept('http://foo1.org', 'bar1', 'Foobar1'), [pid('concept')]))
      )
      .withOption(new mdl.IdentifiableValue(pid('concept')).withMinMax(1, 1)
        .withConstraint(new mdl.CodeConstraint(new mdl.Concept('http://foo2.org', 'bar2', 'Foobar2')))
      )
    )
    .withField(new mdl.IdentifiableValue(pid('concept')).withMinMax(1, 1)
      .withConstraint(new mdl.CodeConstraint(new mdl.Concept('http://foo3.org', 'bar3', 'Foobar3')))
    )
    .withField(new mdl.IdentifiableValue(id(ns, 'Coded')).withMinMax(1, 1)
      .withConstraint(new mdl.CodeConstraint(new mdl.Concept('http://foo4.org', 'bar4', 'Foobar4'), [pid('concept')]))
    );
  add(specs, fce);
  if (addSubElements) {
    addCodedElement(specs, ns);
  }

}

function addSimpleChildElement(specs, ns, isEntry=false) {
  let sc1 = new mdl.DataElement(id(ns, 'SimpleChild'), isEntry)
      .withBasedOn(id(ns, 'Simple'))
      .withDescription('A derivative of the simple type.')
      .withValue(new mdl.IdentifiableValue(pid('string')).withMinMax(1, 1));
  add(specs, sc1);
}

function addSimpleChildEntry(specs, ns) {
  addSimpleChildElement(specs, ns, true);
}

function add(specs, ...dataElements) {
  for (const de of dataElements) {
    specs.namespaces.add(new mdl.Namespace(de.identifier.namespace));
    specs.dataElements.add(de);
  }
}

function id(namespace, name) {
  return new mdl.Identifier(namespace, name);
}

function pid(name) {
  return new mdl.PrimitiveIdentifier(name);
}

module.exports = {commonExportTests, MODELS_INFO: mdl.MODELS_INFO};
