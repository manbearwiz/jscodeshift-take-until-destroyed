import type {
  API,
  CallExpression,
  Expression,
  FileInfo,
  SpreadElement,
  TSExpressionWithTypeArguments,
} from 'jscodeshift';

export default function transform(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);
  const destroyPropertyNames = new Set<string>();

  const pipeWithTakeUntil = {
    callee: { property: { name: 'pipe' } },
    arguments: (args: (SpreadElement | Expression)[]) =>
      args.some(
        (arg) =>
          j.CallExpression.check(arg) &&
          j.Identifier.check(arg.callee) &&
          arg.callee.name === 'takeUntil' &&
          arg.arguments.length === 1 &&
          j.MemberExpression.check(arg.arguments[0]) &&
          j.ThisExpression.check(arg.arguments[0].object),
      ),
  } as const;

  function replaceTakeUntil(pipeNode: CallExpression, addDestroyRef = false) {
    if (
      j.CallExpression.check(pipeNode) &&
      j.CallExpression.check(pipeNode.arguments[0]) &&
      j.MemberExpression.check(pipeNode.callee) &&
      j.Identifier.check(pipeNode.callee.property) &&
      pipeNode.callee.property.name === 'pipe'
    ) {
      const takeUntilNode = pipeNode.arguments.find(
        (arg): arg is CallExpression =>
          j.CallExpression.check(arg) &&
          j.Identifier.check(arg.callee) &&
          arg.callee.name === 'takeUntil',
      );
      const arg = takeUntilNode?.arguments[0];
      if (
        j.MemberExpression.check(arg) &&
        j.Identifier.check(arg.property) &&
        j.ThisExpression.check(arg.object) &&
        j.Identifier.check(takeUntilNode?.callee) &&
        takeUntilNode.callee.name === 'takeUntil'
      ) {
        takeUntilNode.callee.name = 'takeUntilDestroyed';
        takeUntilNode.arguments = addDestroyRef
          ? [j.memberExpression(j.thisExpression(), j.identifier('destroyRef'))]
          : [];
        destroyPropertyNames.add(arg.property.name);
        return arg.property.name;
      }
    }
    return null;
  }

  function addImport(
    root: ReturnType<typeof j>,
    importPath: string,
    importSpecifier: string,
    afterImportPath?: string,
  ) {
    const importDeclaration = root.find(j.ImportDeclaration, {
      source: { value: importPath },
    });

    if (!importDeclaration.length) {
      const importStatement = j.importDeclaration(
        [j.importSpecifier(j.identifier(importSpecifier))],
        j.literal(importPath),
      );

      const afterImport = root.find(j.ImportDeclaration, {
        source: afterImportPath ? { value: afterImportPath } : {},
      });
      if (afterImport.length) {
        afterImport.at(afterImport.length - 1).insertAfter(importStatement);
      }
    } else {
      importDeclaration.forEach((path) => {
        if (
          !path.node.specifiers?.some(
            (spec) =>
              j.ImportSpecifier.check(spec) &&
              j.Identifier.check(spec.imported) &&
              spec.imported.name === importSpecifier,
          )
        ) {
          path.node.specifiers?.push(
            j.importSpecifier(j.identifier(importSpecifier)),
          );
          // biome-ignore lint/suspicious/noExplicitAny: these are all ImportSpecifier nodes
          path.node.specifiers?.sort((a: any, b: any) =>
            Intl.Collator().compare(a.imported.name, b.imported.name),
          );
        }
      });
    }
  }

  function removeImport(
    root: ReturnType<typeof j>,
    importPath: string,
    importSpecifier: string,
  ) {
    root
      .find(j.ImportDeclaration, { source: { value: importPath } })
      .forEach((declaration) => {
        j(declaration)
          .find(j.ImportSpecifier, { imported: { name: importSpecifier } })
          .forEach((specifier) => specifier.prune());

        if (!declaration.node.specifiers?.length) {
          declaration.prune();
        }
      });
  }

  root
    .find(j.ClassDeclaration, {
      superClass: null,
      implements: (impls) =>
        impls?.some(
          (impl) =>
            j.TSExpressionWithTypeArguments.check(impl) &&
            j.Identifier.check(impl.expression) &&
            impl.expression.name === 'OnDestroy',
        ) ?? false,
    })
    .forEach((classPath) => {
      j(classPath)
        .find(j.ClassMethod, { key: { name: 'constructor' } })
        .forEach((path) => {
          j(path)
            .find(j.CallExpression, pipeWithTakeUntil)
            .forEach(({ node }) => replaceTakeUntil(node));
        });

      j(classPath)
        .find(j.ClassProperty, { value: pipeWithTakeUntil })
        .forEach(
          ({ node }) =>
            j.CallExpression.assert(node.value) && replaceTakeUntil(node.value),
        );

      const needsDestroyRef = j(classPath).find(
        j.CallExpression,
        pipeWithTakeUntil,
      );
      needsDestroyRef.forEach(({ node }) => replaceTakeUntil(node, true));

      destroyPropertyNames.forEach((destroyPropertyName) => {
        j(classPath)
          .find(j.ClassProperty, { key: { name: destroyPropertyName } })
          .forEach((path) => {
            let init = path.node.value;
            path.prune();

            if (!j.NewExpression.check(init)) {
              j(classPath)
                .find(j.ClassMethod, { key: { name: 'constructor' } })
                .forEach((path) => {
                  j(path)
                    .find(j.ExpressionStatement, {
                      expression: {
                        type: 'AssignmentExpression',
                        left: {
                          type: 'MemberExpression',
                          object: { type: 'ThisExpression' },
                          property: {
                            type: 'Identifier',
                            name: destroyPropertyName,
                          },
                        },
                        right: { type: 'NewExpression' },
                      },
                    })
                    .forEach((path) => {
                      if (
                        j.AssignmentExpression.check(path.node.expression) &&
                        path.node.expression.right
                      ) {
                        init = path.node.expression.right;
                      }
                      path.prune();
                      if (!path.parent?.node.body.body.length) {
                        path.parent.prune();
                      }
                    });
                });
            }

            if (
              j.NewExpression.check(init) &&
              j.Identifier.check(init.callee) &&
              init.callee.name === 'Subject'
            ) {
              const subjectUnused = !j(classPath).find(j.Identifier, {
                name: 'Subject',
              }).length;

              if (subjectUnused) {
                removeImport(root, 'rxjs', 'Subject');
              }
            }
          });

        j(classPath)
          .find(j.ClassMethod, { key: { name: 'ngOnDestroy' } })
          .forEach((path) => {
            path.node.body.body = path.node.body.body.filter(
              (stmt) =>
                !(
                  j.ExpressionStatement.check(stmt) &&
                  j.CallExpression.check(stmt.expression) &&
                  j.MemberExpression.check(stmt.expression.callee) &&
                  j.MemberExpression.check(stmt.expression.callee.object) &&
                  j.ThisExpression.check(
                    stmt.expression.callee.object.object,
                  ) &&
                  j.Identifier.check(stmt.expression.callee.property) &&
                  j.Identifier.check(stmt.expression.callee.object.property) &&
                  destroyPropertyName ===
                    stmt.expression.callee.object.property.name
                ),
            );
            if (!path.node.body.body.length) {
              path.prune();

              classPath.node.implements =
                classPath.node.implements?.filter(
                  (impl): impl is TSExpressionWithTypeArguments =>
                    j.TSExpressionWithTypeArguments.check(impl) &&
                    j.Identifier.check(impl.expression) &&
                    impl.expression.name !== 'OnDestroy',
                ) ?? [];
              removeImport(root, '@angular/core', 'OnDestroy');
            }
          });
      });

      if (needsDestroyRef.length) {
        const hasDestroyRef = j(classPath).find(j.ClassProperty, {
          key: { name: 'destroyRef' },
        }).length;

        if (!hasDestroyRef) {
          const destroyRefProperty = j.classProperty.from({
            access: 'private',
            key: j.identifier('destroyRef'),
            value: j.callExpression(j.identifier('inject'), [
              j.identifier('DestroyRef'),
            ]),
          });
          // biome-ignore lint/suspicious/noExplicitAny: types just seem to be wrong here
          (destroyRefProperty as any).readonly = true;
          classPath.node.body.body.unshift(destroyRefProperty);
          addImport(root, '@angular/core', 'DestroyRef');
          addImport(root, '@angular/core', 'inject');
        }
      }

      if (destroyPropertyNames.size) {
        addImport(
          root,
          '@angular/core/rxjs-interop',
          'takeUntilDestroyed',
          '@angular/core',
        );
        removeImport(root, 'rxjs/operators', 'takeUntil');
      }
    });

  return root.toSource();
}

export const parser = 'ts';
