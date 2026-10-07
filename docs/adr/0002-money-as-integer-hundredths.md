# Money stored as integer hundredths in every currency

All amounts, including HUF, are stored as integers in hundredths of the currency unit, even though fillér no longer exists. One uniform scale keeps arithmetic and conversions simple and leaves room for fractional forints produced by exchange-rate conversion or future bank imports; HUF is merely displayed without decimals. Exchange rates are never handled as binary floating point.
