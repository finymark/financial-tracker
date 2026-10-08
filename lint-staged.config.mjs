const quote = (file) => JSON.stringify(file.replaceAll('\\', '/'))

export default {
  '*': (files) => {
    const paths = files.map(quote).join(' ')
    const scripts = files.filter((file) =>
      /\.(?:[cm]?js|jsx|tsx?)$/i.test(file),
    )
    return [
      `node scripts/check-files.mjs -- ${paths}`,
      ...(scripts.length ? [`eslint -- ${scripts.map(quote).join(' ')}`] : []),
      `prettier --check --ignore-unknown -- ${paths}`,
    ]
  },
}
