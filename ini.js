/*
    Copyright 2013 Tim Okrongli.
    All rights reserved.

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of ini.software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and ini.permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
*/

/*
    Based on the node.js ini parser/serializer by Isaac Z. Schlueter.
    See https://github.com/isaacs/ini
*/

var ini =
{
    eol: "\r\n",
    //eol: navigator.appVersion.indexOf("Win") != -1 ? "\r\n" : "\n",

    safe: function(val)
    {
        return (typeof val !== "string"
                || val.match(/[\r\n]/)
                || val.match(/^\[/)
                || (val.length > 1
                    && val.charAt(0) === "\""
                    && val.slice(-1) === "\"")
                || val !== val.trim())
                ? JSON.stringify(val)
                : val.replace(/;/g, '\\;');
    },

    unsafe: function(val, doUnesc)
    {
        val = (val || "").trim();

        if (val.charAt(0) === "\"" && val.slice(-1) === "\"")
        {
            try
            {
                val = JSON.parse(val);
            }
            catch (_) {}
        }
        else
        {
            // walk the val to find the first not-escaped ; character
            var esc = false;
            var unesc = "";

            for (var i = 0, l = val.length; i < l; i++)
            {
                var c = val.charAt(i);

                if (esc)
                {
                    if (c === "\\" || c === ";")
                    {
                        unesc += c;
                    }
                    else
                    {
                        unesc += "\\" + c;
                    }

                    esc = false;
                }
                else if (c === ";")
                {
                    break;
                }
                else if (c === "\\")
                {
                    esc = true;
                }
                else
                {
                    unesc += c;
                }
            }

            if (esc)
            {
                unesc += "\\";
            }

            return unesc;
        }

        return val;
    },

    dotSplit: function(str)
    {
        return str.replace(/\1/g, '\2LITERAL\\1LITERAL\2')
                  .replace(/\\\./g, '\1')
                  .split(/\./).map(function (part)
                  {
                        return part.replace(/\1/g, '\\.')
                                   .replace(/\2LITERAL\\1LITERAL\2/g, '\1');
                  });
    },

    encode: function(obj, section)
    {
        var children = [];
        var out = "";

        Object.keys(obj).forEach(function (k, _, __)
        {
            var val = obj[k];

            if (val && Array.isArray(val))
            {
                val.forEach(function(item)
                {
                    out += ini.safe(k + "[]") + " = " + ini.safe(item) + "\n"
                });
            }
            else if (val && typeof val === "object")
            {
                children.push(k);
            }
            else
            {
                out += ini.safe(k) + " = " + ini.safe(val) + ini.eol;
            }
        })

        if (section && out.length)
        {
            out = "[" + ini.safe(section) + "]" + ini.eol + out;
        }

        children.forEach(function (k, _, __)
        {
            var nk = ini.dotSplit(k).join('\\.');
            var child = ini.encode(obj[k], (section ? section + "." : "") + nk);

            if (out.length && child.length)
            {
                out += ini.eol;
            }
            out += child;
        });

        return out;
    },

    decode: function(str)
    {
        var out = {};
        var p = out;
        var section = null;
        var state = "START";
        // section         |key = value
        var re = /^\[([^\]]*)\]$|^([^=]+)(=(.*))?$/i;
        var lines = str.split(/[\r\n]+/g);
        var section = null;

        lines.forEach(function (line, _, __)
        {
            if (!line || line.match(/^\s*;/)) return;

            var match = line.match(re);

            if (!match) return;

            if (match[1] !== undefined)
            {
                section = ini.unsafe(match[1]);
                p = out[section] = out[section] || {};
                return;
            }

            var key = ini.unsafe(match[2]);
            var value = match[3] ? ini.unsafe((match[4] || "")) : true;

            switch (value)
            {
                case 'true':
                case 'false':
                case 'null':
                    value = JSON.parse(value);
            }

            // Convert keys with '[]' suffix to an array
            if (key.length > 2 && key.slice(-2) === "[]")
            {
                key = key.substring(0, key.length - 2);

                if (!p[key])
                {
                    p[key] = [];
                }
                else if (!Array.isArray(p[key]))
                {
                    p[key] = [p[key]];
                }
            }

            // safeguard against resetting a previously defined
            // array by accidentally forgetting the brackets
            if (Array.isArray(p[key]))
            {
                p[key].push(value);
            }
            else
            {
                p[key] = value;
            }
        });

        // {a:{y:1},"a.b":{x:2}} --> {a:{y:1,b:{x:2}}}
        // use a filter to return the keys that have to be deleted.
        Object.keys(out).filter(function (k, _, __)
        {
            if (!out[k] || typeof out[k] !== "object" || Array.isArray(out[k])) return false;

            // see if the parent section is also an object.
            // if so, add it to that, and mark ini.one for deletion
            var parts = ini.dotSplit(k);
            var p = out;
            var l = parts.pop();
            var nl = l.replace(/\\\./g, '.');

            parts.forEach(function (part, _, __)
            {
                if (!p[part] || typeof p[part] !== "object") p[part] = {};
                p = p[part];
            });

            if (p === out && nl === l) return false;
            p[nl] = out[k];
            return true;
        }).forEach(function (del, _, __)
        {
            delete out[del];
        })

        return out;
    }
}