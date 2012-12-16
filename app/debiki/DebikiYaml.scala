/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */


package debiki

import com.debiki.v0.Prelude._
import org.yaml.{snakeyaml => y}
import y.{constructor => yc, nodes => yn}
import scala.collection.{mutable => mut}
import java.{io => jio, util => ju, lang => jl}
import com.debiki.v0.DebikiException


object DebikiYaml {

  def parseYamlToMap(yamlText: String): Map[String, Any] = {
    val yaml: y.Yaml = new y.Yaml(new y.constructor.SafeConstructor)
    val yamlObj = yaml.load(yamlText)
    val javaMap: ju.Map[String, Any] =
      try { yamlObj.asInstanceOf[ju.Map[String, Any]] }
      catch {
        case ex: jl.ClassCastException =>
          throw DebikiException(
            "DwE4BA3", "Bad config file: The config file is not a Yaml map")
      }

    if (javaMap eq null)
      return Map.empty

    import scala.collection.JavaConversions._
    val scalaMap: Map[String, Any] = javaMap.toMap
    scalaMap
  }

}

