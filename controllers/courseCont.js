// import AWS from "aws-sdk"
import { nanoid } from "nanoid"
import Course from "../models/courseModel"
import slugify from "slugify"
import { readFileSync } from "fs"
import User from "../models/userModel"
import cloudinary from "../utils/cloudinary"
import YTList from "../models/lessonModel"

const stripe = require("stripe")(process.env.STRIPE_SECRET)

// const updateRoom = catchAsyncErrors(async (req, res) => {
//   console.log(req.method)
//   let room = await Room.findById(req.query.id)

//   if (!room) {
//     return next(new ErrorHandler("Room not found with this ID", 404))
//   }

//   if (req.body.images) {
//     // Delete images associated with the room
//     for (let i = 0; i < room.images.length; i++) {
//       await cloudinary.v2.uploader.destroy(room.images[i].public_id)
//     }

//     let imagesLinks = []
//     const images = req.body.images

//     for (let i = 0; i < images.length; i++) {
//       const result = await cloudinary.v2.uploader.upload(images[i], {
//         folder: "bookit/rooms",
//       })

//       imagesLinks.push({
//         public_id: result.public_id,
//         url: result.secure_url,
//       })
//     }

//     req.body.images = imagesLinks
//   }

//   room = await Room.findByIdAndUpdate(req.query.id, req.body, {
//     new: true,
//     runValidators: true,
//     useFindAndModify: false,
//   })

//   res.status(200).json({
//     success: true,
//     room,
//   })
// })

export const update = async (req, res) => {
  // console.log(req.body.images[0].public_id)

  try {
    const { slug } = req.query
    // console.log(slug)

    const course = await Course.findOne({ slug }).exec()

    if (req.user._id != course.instructor) {
      return res.status(400).json({ message: "Unathorized" })
    }

    await cloudinary.uploader.destroy(req.body.images[0].public_id)
    const fileStr = req.body.image
    const result = await cloudinary.uploader.upload(fileStr, {
      folder: "ofu",
    })

    let imagesLinks = []

    imagesLinks.push({
      public_id: result.public_id,
      url: result.secure_url,
    })

    req.body.images = imagesLinks

    const updated = await Course.findOneAndUpdate({ slug }, req.body, {
      new: true,
    }).exec()

    res.json(updated)
  } catch (error) {
    console.log(error)
    return res.status(400).send(error.message)
  }
}

export const uploadImage = async (req, res) => {
  // console.log(req.body.image)

  // return

  const fileStr = req.body.image
  const result = await cloudinary.uploader.upload(fileStr, {
    folder: "ofu",
  })
  // console.log(result)

  //   console.log(result)

  let imagesLinks = []

  imagesLinks.push({
    public_id: result.public_id,
    url: result.secure_url,
  })

  req.body.images = imagesLinks

  // console.log(req.body.images)

  const course = await Course.create(req.body)

  console.log(course)

  res.status(200).json({
    success: true,
    course,
  })
}

export const create = async (req, res) => {
  if (req.body.paid === true && req.body.price === 0) {
    req.body.price = 9.99
  }

  const fileStr = req.body.image
  const result = await cloudinary.uploader.upload(fileStr, {
    folder: "ofu",
  })
  const alreadyExist = await Course.findOne({
    slug: slugify(req.body.title.toLowerCase()),
  })
  if (alreadyExist) return res.status(400).send("Title is taken")

  let imagesLinks = []

  imagesLinks.push({
    public_id: result.public_id,
    url: result.secure_url,
  })

  req.body.images = imagesLinks

  const course = await new Course({
    slug: slugify(req.body.title),
    instructor: req.user._id,
    ...req.body,
  }).save()

  res.status(200).json({
    success: true,
    course,
  })
}

export const instructorCourses = async (req, res) => {
  // console.log(req.method, req.user)

  try {
    const courses = await Course.find({ instructor: req.user._id })
      .sort({ createdAt: -1 })
      .exec()
    res.status(200).json(courses)
  } catch (err) {
    console.log(err)
  }
}

export const readCourse = async (req, res) => {
  const { slug } = req.query

  try {
    const course = await Course.findOne({ slug: slug })
      .populate("instructor", "_id name")
      .exec()

    const ytList = await YTList.findOne({
      slug: slug,
    })

    // const courseList = [course, ytList]

    res.send(course)
  } catch (error) {
    console.log(error)
  }
}

export const uploadVideo = async (req, res) => {
  // console.log(req.method)
  // console.log(req.query.instructorId)

  try {
    // console.log(req.user._id)

    if (req.user._id != req.query.instructorId) {
      return res.status(400).json({ message: "Unathorized" })
    }

    const { video } = req.files
    // console.log(video)

    if (!video) res.status(400).json({ message: "No Video" })

    const params = {
      Bucket: "ofu-bucket",
      Key: `${nanoid()}.${video.type.split("/")[1]}`,
      Body: readFileSync(video.path),
      ACL: "public-read",
      ContentType: video.type,
    }

    S3.upload(params, (err, data) => {
      if (err) {
        console.log(err)
        return res.status(400)
      }
      // console.log(data)
      res.send(data)
    })
  } catch (error) {
    console.log(error)
  }
}
export const removeVideo = async (req, res) => {
  // console.log(req.body)
  // console.log(req.method)

  try {
    if (req.user._id != req.query.instructorId) {
      return res.status(400).json({ message: "Unathorized" })
    }

    const { Bucket, Key } = req.body

    // console.log(video)
    // return

    const params = {
      Bucket,
      Key,
    }

    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.log(err)
        return res.status(400)
      }
      // console.log(data)
      res.send({ ok: true })
    })
  } catch (error) {
    console.log(error)
  }
}

export const addLesson = async (req, res) => {
  try {
    const { slug, instructorId } = req.query
    const { title, content, video } = req.body
    // console.log(req.query)
    // console.log(req.body)

    if (req.user._id != instructorId) {
      return res.status(400).json({ message: "Unathorized" })
    }

    const updated = await Course.findOneAndUpdate(
      { slug },
      {
        $push: { lessons: { title, content, video, slug: slugify(title) } },
      },
      { new: true }
    )
      .populate("instructor", "_id name")
      .exec()

    res.json(updated)
  } catch (error) {
    console.log(error)
    return res.status(400).send("add lesson failed")
  }
}

export const removeLesson = async (req, res) => {
  try {
    const { slug, lessonId } = req.query
    console.log(lessonId)

    const course = await Course.findOne({ slug }).exec()
    if (req.user._id != course.instructor) {
      return res.status(400).send("Unauthorized")
    }

    const deletedlesson = await Course.findByIdAndUpdate(course._id, {
      $pull: { lessons: { _id: lessonId } },
    }).exec()

    res.json({ ok: true, deletedlesson })
  } catch (error) {
    console.log(error)
  }
}

export const updateLesson = async (req, res) => {
  // console.log(req.query, req.body)
  // return
  try {
    const { slug } = req.query
    console.log(slug)
    const { title, _id, content, video, free_preview } = req.body

    const course = await Course.findOne({ slug }).select("instructor").exec()
    console.log(course.instructor._id, title, _id, content, video, free_preview)

    if (req.user._id != course.instructor._id) {
      return res.status(400).json({ message: "Unathorized" })
    }

    const updated = await Course.updateOne(
      { "lessons._id": _id },
      {
        $set: {
          "lessons.$.title": title,
          "lessons.$.content": content,
          "lessons.$.video": video,
          "lessons.$.free_preview": free_preview,
        },
      },
      { new: true }
    ).exec()
    console.log("update", updated)
    res.json({ ok: true })
  } catch (error) {
    console.log(error)

    return res.status(400).send("Update lessons failed")
  }
}

export const publishCourse = async (req, res) => {
  try {
    const { courseId } = req.query
    const course = await Course.findById(courseId).select("instructor").exec()
    if (req.user._id != course.instructor._id) {
      return res.status(400).json({ message: "Unathorized" })
    }

    const updated = await Course.findByIdAndUpdate(
      courseId,
      { published: true },
      { new: true }
    ).exec()

    res.json(updated)
  } catch (error) {
    console.log(error)
    return res.status(400).send("Publish course failed")
  }
}

export const unpublishCourse = async (req, res) => {
  try {
    const { courseId } = req.query
    const course = await Course.findById(courseId).select("instructor").exec()
    if (req.user._id != course.instructor._id) {
      return res.status(400).json({ message: "Unathorized" })
    }
    const updated = await Course.findByIdAndUpdate(
      courseId,
      { published: false },
      { new: true }
    ).exec()

    res.json(updated)
  } catch (error) {
    console.log(error)
    return res.status(400).send("Un-ublish course failed")
  }
}

export const courses = async (req, res) => {
  try {
    const all = await Course.find({ published: true })
      .populate("instructor", "_id name")
      .exec()
    res.json(all)
  } catch (error) {}
}

export const checkEnrollment = async (req, res) => {
  try {
    const { courseId } = req.query

    const user = await User.findById(req.user._id).exec()

    let ids = []
    let length = user.courses && user.courses.length

    for (let i = 0; i < length; i++) {
      ids.push(user.courses[i].toString())
    }

    res.json({
      status: ids.includes(courseId),
      course: await Course.findById(courseId).exec(),
    })
  } catch (error) {
    console.log(error)
  }
}

export const freeEnrollment = async (req, res) => {
  try {
    const course = await Course.findById(req.query.courseId).exec()
    if (course.paid) return
    const result = await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: { courses: course._id },
      },
      { new: true }
    ).exec()
    res.json({ message: "You have enrolled", course: course })
  } catch (error) {
    console.log(error)
    return res.status(400).send("Enrollment create failed")
  }
}

export const paidEnrollment = async (req, res) => {
  try {
    // check if course is free or paid
    const course = await Course.findById(req.query.courseId)
      .populate("instructor")
      .exec()
    if (!course.paid) return
    // application fee 30%
    const fee = (course.price * 30) / 100

    console.log(course.instructor.stripe_account_id)

    // create stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      // purchase details
      line_items: [
        {
          name: course.title,
          amount: Math.round(course.price.toFixed(2) * 100),
          currency: "usd",
          quantity: 1,
        },
      ],
      // charge buyer and transfer remaining balance to seller (after fee)

      payment_intent_data: {
        application_fee_amount: Math.round(fee.toFixed(2) * 100),
        transfer_data: {
          destination: course.instructor.stripe_account_id,
        },
      },
      // redirect url after successful payment
      success_url: `${process.env.STRIPE_SUCCESS_URL}/${course._id}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
    })
    // console.log("SESSION ID => ", session)

    await User.findByIdAndUpdate(req.user._id, {
      stripeSession: session,
    }).exec()
    res.send(session.id)
  } catch (err) {
    console.log("PAID ENROLLMENT ERR", err)
    return res.status(400).send("Enrollment create failed")
  }
}

export const stripeSuccess = async (req, res) => {
  console.log(req.method, req.user, req.query.id)

  try {
    const course = await Course.findById(req.query.id).exec()
    const user = await User.findById(req.user._id).exec()

    if (!user.stripeSession.id) return res.sendStatus(400)

    const session = await stripe.checkout.sessions.retrieve(
      user.stripeSession.id
    )
    console.log("Stripe success", session)
    if (session.payment_status === "paid") {
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { courses: course._id },
        $set: { stripeSession: {} },
      }).exec()
      res.json({ success: true, course })
    }
    // res.send(session.id)
  } catch (error) {
    console.log("stipe error", error)
  }
}

export const userCourses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).exec()
    const courses = await Course.find({ _id: { $in: user.courses } })
      .populate("instructor", "_id name")
      .exec()
    res.json(courses)
  } catch (error) {
    console.log(error)
  }
}

export const markCompleted = async (req, res) => {
  const { courseId, lessonId } = req.body
  // console.log(courseId, lessonId)

  // find if user with that course is already created
  const existing = await Completed.findOne({
    user: req.user._id,
    course: courseId,
  }).exec()

  if (existing) {
    // update
    const updated = await Completed.findOneAndUpdate(
      {
        user: req.user._id,
        course: courseId,
      },
      {
        $addToSet: { lessons: lessonId },
      }
    ).exec()
    res.json({ ok: true })
  } else {
    // create
    const created = await new Completed({
      user: req.user._id,
      course: courseId,
      lessons: lessonId,
    }).save()
    res.json({ ok: true })
  }
}

export const listCompleted = async (req, res) => {
  try {
    const list = await Completed.findOne({
      user: req.user._id,
      course: req.body.courseId,
    }).exec()
    list && res.json(list.lessons)
  } catch (err) {
    console.log(err)
  }
}

export const markIncomplete = async (req, res) => {
  try {
    const { courseId, lessonId } = req.body

    const updated = await Completed.findOneAndUpdate(
      {
        user: req.user._id,
        course: courseId,
      },
      {
        $pull: { lessons: lessonId },
      }
    ).exec()
    res.json({ ok: true })
  } catch (err) {
    console.log(err)
  }
}
